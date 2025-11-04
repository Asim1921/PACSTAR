# PACSTAR Authentication Service - Frontend

A military-grade cybersecurity challenge management platform with a professional, modern authentication interface.

## 🎨 Color Scheme

- **Primary (Steel Blue):** `#1E3A5F`
- **Secondary (Slate Gray):** `#3A506B`
- **Accent (Tech Green):** `#3FFF8C`
- **Background (Off Black):** `#101820`
- **Text (Ghost White):** `#F1F3F5`
- **Warning (Tactical Orange):** `#FF7A00`

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/
│   ├── globals.css          # Global styles and theme
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page (Auth)
├── components/
│   ├── auth/
│   │   ├── AuthLayout.tsx   # Main authentication layout
│   │   ├── LoginForm.tsx    # Login form component
│   │   └── RegisterForm.tsx # Registration form component
│   └── ui/
│       ├── Button.tsx       # Reusable button component
│       ├── Input.tsx        # Reusable input component
│       ├── Select.tsx       # Reusable select component
│       ├── RadioGroup.tsx   # Radio button group component
│       └── InfoBox.tsx      # Information box component
├── lib/
│   └── api.ts               # API client and endpoints
└── public/                  # Static assets
```

## 🔌 API Configuration

The frontend communicates with the FastAPI backend at:
- Base URL: `http://192.168.250.178:8000/api/v1`

API endpoints are configured in `lib/api.ts`. Update the `API_BASE_URL` if your backend URL changes.

## ✨ Features

### Authentication Pages

1. **Login Page**
   - Username and password authentication
   - Form validation
   - Error handling
   - Loading states

2. **Registration Page**
   - Three registration types:
     - **Join a team (Team Code):** Join existing team with code
     - **Create new team:** Create team and become leader
     - **Individual (Zone):** Join as individual, assigned to zone
   - Comprehensive form validation
   - Dynamic form fields based on registration type
   - Informational messages

### UI Components

- Modern, military-grade aesthetic
- Responsive design
- Glass morphism effects
- Smooth animations and transitions
- Glow effects for accent elements
- Professional color scheme

## 🛠️ Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **Lucide React** - Icons

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🎯 Next Steps

After successful authentication, users are redirected to `/dashboard`. You'll need to create the dashboard page and other protected routes.

## 📄 License

This project is part of a college-level cybersecurity project.

