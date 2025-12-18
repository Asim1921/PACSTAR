from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
import tempfile
import zipfile
import os
import shutil
import subprocess

from app.api.v1.endpoints.user import get_current_user
from app.schemas.user import UserResponse

router = APIRouter(prefix="", tags=["builder"])


def _run_command(command: List[str], cwd: Optional[str] = None) -> Dict[str, Any]:
    try:
        process = subprocess.Popen(
            command,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        logs: List[str] = []
        if process.stdout is not None:
            for line in process.stdout:
                logs.append(line.rstrip("\n"))
        retcode = process.wait()
        return {"returncode": retcode, "logs": logs}
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Command not found: {command[0]}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/build-image")
async def build_image_from_zip(
    current_user: UserResponse = Depends(get_current_user),
    file: UploadFile = File(...),
    image_name: str = Form(...),
    dockerfile_path: str = Form("Dockerfile"),
    context_subdir: str = Form(""),
    push_to_registry: bool = Form(False),
    registry: Optional[str] = Form(None)
):
    """
    Accept a ZIP bundle, extract it, and build a Docker image locally.
    Only Master/Admin users are allowed.
    """
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master/Admin can build images")

    tmp_dir = tempfile.mkdtemp(prefix="build_zip_")
    extract_dir = os.path.join(tmp_dir, "bundle")
    os.makedirs(extract_dir, exist_ok=True)
    zip_path = os.path.join(tmp_dir, file.filename)

    try:
        with open(zip_path, "wb") as out:
            content = await file.read()
            out.write(content)
        # Validate and extract
        if not zipfile.is_zipfile(zip_path):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is not a valid ZIP")
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_dir)

        build_context = extract_dir
        if context_subdir:
            candidate = os.path.join(extract_dir, context_subdir)
            if not os.path.isdir(candidate):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="context_subdir not found in archive")
            build_context = candidate

        dockerfile_abs = os.path.join(build_context, dockerfile_path)
        if not os.path.isfile(dockerfile_abs):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dockerfile path not found in build context")

        # Build image
        cmd = [
            "docker", "build",
            "-f", dockerfile_abs,
            "-t", image_name,
            build_context
        ]
        result = _run_command(cmd)
        logs: List[str] = result.get("logs", [])
        success = result.get("returncode", 1) == 0
        if not success:
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={
                "success": False,
                "image": image_name,
                "logs": logs
            })

        pushed_image: Optional[str] = None
        if push_to_registry and registry:
            reg = registry.strip().rstrip('/')
            
            # Check if image_name already includes the registry
            if image_name.startswith(f"{reg}/"):
                # Image already has registry prefix, just push it
                dst = image_name
                logs.append(f"Image already tagged with registry: {dst}")
            else:
                # Need to tag with registry prefix
                dst = f"{reg}/{image_name}"
                logs.append(f"Tagging image: {image_name} -> {dst}")
                tag_res = _run_command(["docker", "tag", image_name, dst])
                logs += tag_res.get("logs", [])
                if tag_res.get("returncode", 1) != 0:
                    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={
                        "success": False,
                        "image": image_name,
                        "logs": logs + ["❌ docker tag failed"],
                    })
            
            # Push to registry
            logs.append(f"Pushing to registry: {dst}")
            push_res = _run_command(["docker", "push", dst])
            logs += push_res.get("logs", [])
            if push_res.get("returncode", 1) != 0:
                return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={
                    "success": False,
                    "image": image_name,
                    "pushed_image": dst,
                    "logs": logs + ["❌ docker push failed"],
                })
            pushed_image = dst
            logs.append(f"✅ Successfully pushed: {dst}")

        return {"success": True, "image": image_name, "pushed_image": pushed_image, "logs": logs}
    finally:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


@router.get("/images", response_model=List[Dict[str, str]])
async def list_local_images(current_user: UserResponse = Depends(get_current_user)):
    """List local Docker images for selection in UI."""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master/Admin can list images")

    cmd = [
        "docker", "images", "--format", "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}"
    ]
    result = _run_command(cmd)
    if result.get("returncode", 1) != 0:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list images")
    images: List[Dict[str, str]] = []
    for line in result.get("logs", []):
        try:
            repo_tag, image_id, created, size = line.split("|")
            images.append({
                "name": repo_tag,
                "id": image_id,
                "created": created,
                "size": size
            })
        except Exception:
            continue
    return images


@router.delete("/images/{image_name:path}")
async def delete_image(
    image_name: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete a Docker image from local registry and local Docker"""
    if current_user.role not in ["Master", "Admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master/Admin can delete images")
    
    logs: List[str] = []
    try:
        # Try to remove from local Docker
        result = _run_command(["docker", "rmi", "-f", image_name])
        logs += result.get("logs", [])
        
        if result.get("returncode", 1) == 0:
            return {"success": True, "message": f"Image {image_name} deleted", "logs": logs}
        else:
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={
                "success": False,
                "message": f"Failed to delete image {image_name}",
                "logs": logs
            })
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/kill-all")
async def kill_all_challenges(
    current_user: UserResponse = Depends(get_current_user)
):
    """Kill all challenge namespaces and pods (Master only)"""
    if current_user.role != "Master":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Master can kill all challenges")
    
    logs: List[str] = []
    try:
        # Get all namespaces first
        result = _run_command(["kubectl", "get", "namespaces", "-o", "name"])
        all_ns_output = "\n".join(result.get("logs", []))
        
        # Filter namespaces that start with "challenge-"
        namespaces = []
        for line in all_ns_output.split("\n"):
            # Format is: namespace/challenge-xyz
            if line.startswith("namespace/challenge-"):
                ns_name = line.replace("namespace/", "").strip()
                namespaces.append(ns_name)
        
        logs.append(f"🔍 Found {len(namespaces)} challenge namespace(s)")
        if namespaces:
            logs.append(f"   Namespaces: {', '.join(namespaces)}")
        else:
            logs.append("   No challenge namespaces found")
        logs.append("")
        
        deleted_count = 0
        failed_count = 0
        
        for ns in namespaces:
            logs.append(f"🗑️  Deleting namespace: {ns}")
            delete_result = _run_command(["kubectl", "delete", "namespace", ns, "--timeout=60s"])
            
            if delete_result.get("returncode", 1) == 0:
                deleted_count += 1
                logs.append(f"   ✅ Successfully deleted {ns}")
                # Add kubectl output
                ns_logs = delete_result.get("logs", [])
                if ns_logs:
                    logs.append(f"   Output: {' '.join(ns_logs)}")
            else:
                failed_count += 1
                logs.append(f"   ❌ Failed to delete {ns}")
                # Add error output
                ns_logs = delete_result.get("logs", [])
                if ns_logs:
                    logs.append(f"   Error: {' '.join(ns_logs)}")
            logs.append("")
        
        logs.append("=" * 60)
        logs.append(f"📊 Summary:")
        logs.append(f"   ✅ Successfully deleted: {deleted_count}")
        logs.append(f"   ❌ Failed: {failed_count}")
        logs.append(f"   📦 Total found: {len(namespaces)}")
        logs.append("=" * 60)
        
        return {
            "success": True,
            "message": f"Killed {deleted_count}/{len(namespaces)} challenge namespace(s)",
            "logs": logs,
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "total_found": len(namespaces)
        }
    except Exception as e:
        logs.append(f"❌ ERROR: {str(e)}")
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={
            "success": False,
            "message": f"Failed to kill all: {str(e)}",
            "logs": logs
        })


