from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import FileResponse
from typing import List
import os
import uuid
from datetime import datetime
import aiofiles

from app.api.v1.endpoints.user import get_current_user
from app.db.models.user import UserInDB

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...)
):
    """Upload a challenge file"""
    print(f"🔍 DEBUG: Upload endpoint called")
    print(f"🔍 DEBUG: Request method: {request.method}")
    print(f"🔍 DEBUG: Request URL: {request.url}")
    print(f"🔍 DEBUG: File name: {file.filename}")
    print(f"🔍 DEBUG: File content type: {file.content_type}")
    
    try:
        # Get current user from request state (set by RBAC middleware)
        print(f"🔍 DEBUG: Getting current user from request state")
        current_user = getattr(request.state, "user", None)
        print(f"🔍 DEBUG: Current user: {current_user}")
        
        if not current_user:
            print(f"❌ DEBUG: No current user found")
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        print(f"🔍 DEBUG: User role: {current_user.role}")
        if current_user.role not in ["Master", "Admin"]:
            print(f"❌ DEBUG: Insufficient permissions for role: {current_user.role}")
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Generate unique filename
        print(f"🔍 DEBUG: Generating unique filename")
        file_id = str(uuid.uuid4())
        file_extension = os.path.splitext(file.filename)[1]
        filename = f"{file_id}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        print(f"🔍 DEBUG: File ID: {file_id}")
        print(f"🔍 DEBUG: Filename: {filename}")
        print(f"🔍 DEBUG: File path: {file_path}")
        
        # Check if upload directory exists
        print(f"🔍 DEBUG: Upload directory exists: {os.path.exists(UPLOAD_DIR)}")
        print(f"🔍 DEBUG: Upload directory: {UPLOAD_DIR}")
        
        # Save file
        print(f"🔍 DEBUG: Starting file save process")
        async with aiofiles.open(file_path, 'wb') as f:
            print(f"🔍 DEBUG: Reading file content")
            content = await file.read()
            print(f"🔍 DEBUG: Content length: {len(content)}")
            print(f"🔍 DEBUG: Writing content to file")
            await f.write(content)
            print(f"🔍 DEBUG: File written successfully")
        
        result = {
            "file_id": file_id,
            "filename": file.filename,
            "file_path": file_path,
            "file_size": len(content),
            "download_url": f"/api/v1/files/download/{file_id}"
        }
        print(f"🔍 DEBUG: Returning result: {result}")
        return result
        
    except HTTPException as e:
        print(f"❌ DEBUG: HTTPException: {e.status_code} - {e.detail}")
        raise e
    except Exception as e:
        print(f"❌ DEBUG: Unexpected error: {str(e)}")
        print(f"❌ DEBUG: Error type: {type(e)}")
        import traceback
        print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@router.get("/download/{file_id}")
async def download_file(
    request: Request,
    file_id: str
):
    """Download a challenge file"""
    # Get current user from request state (set by RBAC middleware)
    current_user = getattr(request.state, "user", None)
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Find file by ID
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(file_id):
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                return FileResponse(
                    file_path,
                    filename=filename,
                    media_type='application/octet-stream'
                )
    
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/serve/{file_id}")
async def serve_file(
    request: Request,
    file_id: str
):
    """Serve a challenge file with a clean URL (no auth required for public access)"""
    # Find file by ID
    for filename in os.listdir(UPLOAD_DIR):
        if filename.startswith(file_id):
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                # Get the original filename from the file_id
                original_filename = filename.split('.', 1)[1] if '.' in filename else filename
                return FileResponse(
                    file_path,
                    filename=original_filename,
                    media_type='application/octet-stream'
                )
    
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/list")
async def list_files(
    request: Request
):
    """List all uploaded files"""
    print(f"🔍 DEBUG: List files endpoint called")
    print(f"🔍 DEBUG: Request method: {request.method}")
    print(f"🔍 DEBUG: Request URL: {request.url}")
    
    try:
        # Get current user from request state (set by RBAC middleware)
        print(f"🔍 DEBUG: Getting current user from request state")
        current_user = getattr(request.state, "user", None)
        print(f"🔍 DEBUG: Current user: {current_user}")
        
        if not current_user:
            print(f"❌ DEBUG: No current user found")
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        print(f"🔍 DEBUG: User role: {current_user.role}")
        if current_user.role not in ["Master", "Admin"]:
            print(f"❌ DEBUG: Insufficient permissions for role: {current_user.role}")
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        print(f"🔍 DEBUG: Upload directory: {UPLOAD_DIR}")
        print(f"🔍 DEBUG: Directory exists: {os.path.exists(UPLOAD_DIR)}")
        
        files = []
        if os.path.exists(UPLOAD_DIR):
            file_list = os.listdir(UPLOAD_DIR)
            print(f"🔍 DEBUG: Files in directory: {file_list}")
            
            for filename in file_list:
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.isfile(file_path):
                    stat = os.stat(file_path)
                    file_info = {
                        "filename": filename,
                        "file_id": filename.split('.')[0],
                        "file_size": stat.st_size,
                        "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "download_url": f"/api/v1/files/download/{filename.split('.')[0]}"
                    }
                    files.append(file_info)
                    print(f"🔍 DEBUG: Added file: {file_info}")
        else:
            print(f"❌ DEBUG: Upload directory does not exist")
        
        result = {"files": files}
        print(f"🔍 DEBUG: Returning result: {result}")
        return result
        
    except HTTPException as e:
        print(f"❌ DEBUG: HTTPException: {e.status_code} - {e.detail}")
        raise e
    except Exception as e:
        print(f"❌ DEBUG: Unexpected error: {str(e)}")
        print(f"❌ DEBUG: Error type: {type(e)}")
        import traceback
        print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")
