# 🎨 Professional Portfolio Website

An impressive, modern portfolio website built with React, TypeScript, Tailwind CSS, and Framer Motion. Features a cinematic dark theme with electric lime accents and smooth animations.

## ✨ Features

### Design & Aesthetics
- **Modern Dark Theme**: Sleek slate-950 background with neon lime (#d4fc79) accents
- **Cinematic Typography**: Bold, impactful headings with glowing text effects
- **Glass Morphism**: Semi-transparent frosted glass cards with backdrop blur
- **Smooth Animations**: Framer Motion for entrance animations and hover interactions
- **Responsive Design**: Fully mobile-optimized with adaptive layouts

### Sections
1. **Navigation Bar** - Sticky header with smooth transitions and mobile menu
2. **Hero Section** - Animated particle background, compelling headline, CTAs, and social links
3. **Featured Projects** - Showcase of 3 projects with images, descriptions, tech stacks, and demo links
4. **Skills & Expertise** - Categorized skills in Frontend, Backend, Tools, and UI/UX
5. **Contact Section** - Contact form with email validation and social media links
6. **Footer** - Minimalist footer with copyright and links

### Technical Highlights
- ⚡ **Vite** - Lightning-fast dev experience and build
- 🎯 **React 18** with TypeScript for type safety
- 🎨 **Tailwind CSS v4** for rapid styling
- 🎬 **Framer Motion** for cinematic animations
- 📦 **Lucide Icons** for clean, consistent iconography
- 🎯 **Smooth Scrolling** - Native CSS scroll-behavior
- ♿ **Semantic HTML** for accessibility

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
cd Portfolio
npm install
npm run dev
```

The site will be available at `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

This generates optimized production files in the `dist/` directory.

## 📁 Project Structure

```
Portfolio/
├── src/
│   ├── components/
│   │   ├── Hero.tsx           # Hero section with animations
│   │   ├── Navigation.tsx      # Fixed navigation bar
│   │   ├── Projects.tsx        # Featured projects showcase
│   │   ├── Skills.tsx          # Skills & expertise grid
│   │   ├── Contact.tsx         # Contact form & CTA
│   │   └── Footer.tsx          # Footer section
│   ├── App.tsx                 # Main app component
│   ├── App.css                 # App-specific styles
│   ├── index.css               # Global styles & custom classes
│   └── main.tsx                # Entry point
├── index.html                  # HTML template
├── tailwind.config.js          # Tailwind configuration
├── postcss.config.js           # PostCSS configuration
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies & scripts
```

## 🎨 Customization

### Update Your Information
1. **Navigation Logo** - Edit `<Dev />` in [Navigation.tsx](src/components/Navigation.tsx)
2. **Hero Content** - Update text in [Hero.tsx](src/components/Hero.tsx)
3. **Projects** - Modify the `projects` array in [Projects.tsx](src/components/Projects.tsx)
4. **Skills** - Update the `skills` array in [Skills.tsx](src/components/Skills.tsx)
5. **Social Links** - Change URLs in Hero and Contact components
6. **Footer** - Update copyright name in [Footer.tsx](src/components/Footer.tsx)

### Color Scheme
Primary accent color is electric lime (`#d4fc79`). To change it, update:
1. `tailwind.config.js` - Lime color values
2. CSS variables in `src/index.css` - `.neon-text`, `.glass`, `.glow-button`
3. Inline color classes throughout components

### Fonts
- **Sans**: Inter (UI text)
- **Display**: Space Mono (headings)
- Imported from Google Fonts

## 🛠 Technologies Used

- **React 18.3** - UI library
- **TypeScript 5.5** - Type safety
- **Tailwind CSS 4** - Utility-first CSS
- **Framer Motion 11** - Animation library
- **Vite 8.3** - Build tool
- **Lucide React 1.47** - Icon library

## 📝 Environment Setup

The project includes:
- TypeScript strict mode for better type safety
- ESLint configuration for code quality
- Hot Module Replacement (HMR) for instant updates
- Optimized production builds with minification

## 🔄 Development Workflow

1. **Start Dev Server**: `npm run dev`
2. **Build**: `npm run build`
3. **Preview Build**: `npm run preview`
4. **Type Check**: `npm run tsc --noEmit`

## 📱 Responsive Breakpoints

- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

All components are mobile-first and fully responsive.

## ✅ Next Steps

1. **Customize Content**
   - Replace placeholder text with your actual information
   - Update project links and descriptions
   - Add your social media profiles

2. **Add Projects**
   - Upload project screenshots
   - Update tech stack tags
   - Link to live demos and GitHub repos

3. **Form Integration**
   - Connect contact form to backend (emailjs, Formspree, etc.)
   - Add success/error handling

4. **Deploy**
   - Vercel (recommended for React/Next.js)
   - Netlify
   - GitHub Pages
   - AWS Amplify

## 📄 License

Free to use and customize for your portfolio.

---

**Built with ❤️ using Copilot SDK**
