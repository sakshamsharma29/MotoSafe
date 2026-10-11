# Portfolio Customization Checklist

Complete these steps to personalize your portfolio website.

## 👤 Personal Information

- [ ] Update name in footer (copyright notice)
  - File: `src/components/Footer.tsx`
  - Look for: `© {currentYear} Your Name`

- [ ] Update navigation logo
  - File: `src/components/Navigation.tsx`
  - Change: `<Dev />` to your name/initials

- [ ] Update page title
  - File: `index.html`
  - Change: `<title>Portfolio</title>`

- [ ] Update meta description
  - File: `index.html`
  - Add your description in: `<meta name="description" content="...">`

## 📝 Hero Section

- [ ] Update headline
  - File: `src/components/Hero.tsx`
  - Change: "Crafting Digital Experiences"

- [ ] Update subtitle
  - File: `src/components/Hero.tsx`
  - Change: "Full-stack developer passionate about..."

- [ ] Update GitHub URL
  - File: `src/components/Hero.tsx`
  - Change: `href="https://github.com"` (3 places)

- [ ] Update LinkedIn URL
  - File: `src/components/Hero.tsx`
  - Change: `href="https://linkedin.com"`

- [ ] Update email address
  - File: `src/components/Hero.tsx`
  - Change: `href="mailto:you@example.com"`

## 🎯 Projects Section

For each project in `src/components/Projects.tsx`:

### Project 1: E-Commerce Platform
- [ ] Title: Update "E-Commerce Platform"
- [ ] Description: Update project description
- [ ] Image: Replace image URL with your own
- [ ] Tags: Update tech stack (React, Node.js, PostgreSQL, Stripe)
- [ ] GitHub: Update GitHub repository link
- [ ] Demo: Update live demo URL

### Project 2: AI Chat Application
- [ ] Title: Update "AI Chat Application"
- [ ] Description: Update project description
- [ ] Image: Replace image URL with your own
- [ ] Tags: Update tech stack (React, WebSocket, OpenAI, Tailwind)
- [ ] GitHub: Update GitHub repository link
- [ ] Demo: Update live demo URL

### Project 3: Data Analytics Dashboard
- [ ] Title: Update "Data Analytics Dashboard"
- [ ] Description: Update project description
- [ ] Image: Replace image URL with your own
- [ ] Tags: Update tech stack (React, D3.js, Python, PostgreSQL)
- [ ] GitHub: Update GitHub repository link
- [ ] Demo: Update live demo URL

**Pro Tip**: Use Unsplash, Pexels, or Pixabay for free project images

## 🛠 Skills Section

In `src/components/Skills.tsx`, update each category:

### Frontend Skills
- [ ] React
- [ ] TypeScript
- [ ] Tailwind CSS
- [ ] Next.js
- [ ] Vue.js
- [ ] Framer Motion

### Backend Skills
- [ ] Node.js
- [ ] Express
- [ ] Python
- [ ] PostgreSQL
- [ ] MongoDB
- [ ] GraphQL

### Tools & Platforms
- [ ] Git
- [ ] Docker
- [ ] AWS
- [ ] Vercel
- [ ] CI/CD
- [ ] Jest

### UI/UX
- [ ] Figma
- [ ] Design Systems
- [ ] Accessibility
- [ ] Performance
- [ ] Responsive Design
- [ ] Animation

## 📧 Contact Section

- [ ] Update contact email address
  - File: `src/components/Contact.tsx`
  - Change: `mailto:you@example.com` (appears twice)

- [ ] Setup form submission
  - Integrate with: EmailJS, Formspree, or SendGrid
  - Update `handleSubmit` function in Contact.tsx

- [ ] Test contact form
  - Fill out form locally
  - Verify email sending works

- [ ] Update social media links in Contact footer
  - Email: `mailto:you@example.com`
  - LinkedIn: `https://linkedin.com`
  - GitHub: `https://github.com`

## 🎨 Branding & Style

### Colors
- [ ] Review primary accent color (currently lime)
  - To change: edit `tailwind.config.js`
  - Update color: `#d4fc79` to your preferred color

- [ ] Test color scheme on all sections
  - Hero with lime glow
  - Project cards with lime borders
  - Skill badges with lime accents

### Fonts
- [ ] Verify Inter font loads correctly
- [ ] Verify Space Mono font loads correctly
- [ ] Test on Firefox, Chrome, Safari, Edge

### Responsive Design
- [ ] Test on mobile (375px width)
- [ ] Test on tablet (768px width)
- [ ] Test on desktop (1440px width)
- [ ] Verify mobile menu opens/closes
- [ ] Check all animations work smoothly

## 🚀 Before Deployment

### Code Quality
- [ ] Run build: `npm run build`
- [ ] Check for TypeScript errors: `npm run tsc`
- [ ] Verify no console errors/warnings
- [ ] Test all links (internal and external)

### Performance
- [ ] Verify page loads in < 3 seconds
- [ ] Check Lighthouse score
- [ ] Verify images are optimized
- [ ] Test on slow 3G network

### Content Review
- [ ] Spell-check all text
- [ ] Verify all links work
- [ ] Check email addresses are correct
- [ ] Test contact form submission
- [ ] Verify social links open correctly

### Accessibility
- [ ] Test keyboard navigation (Tab, Enter, Esc)
- [ ] Verify color contrast meets WCAG AA
- [ ] Test with screen reader
- [ ] Check form labels are properly associated

## 📱 Deploy

### Choose a Platform
- [ ] Vercel (easiest for React)
- [ ] Netlify (great for static sites)
- [ ] GitHub Pages (free)
- [ ] AWS Amplify
- [ ] Traditional hosting (cPanel, etc.)

### Before Deploying
- [ ] Run `npm run build` successfully
- [ ] Delete `.env` files (no secrets in repo)
- [ ] Add `.gitignore` entries
- [ ] Create `.git` directory if deploying via Git

### Post-Deployment
- [ ] Visit live URL
- [ ] Test all functionality
- [ ] Verify contact form works
- [ ] Check mobile responsiveness
- [ ] Monitor for errors

## 🔍 Analytics (Optional)

- [ ] Add Google Analytics
  - Add to `index.html` or use package
  - Track visitor engagement

- [ ] Add form submission tracking
  - Monitor contact form usage

- [ ] Setup 404 error page
  - Create for single-page app

## 🔄 Maintenance

- [ ] Update projects quarterly
- [ ] Add new skills as you learn
- [ ] Update experience/bio annually
- [ ] Check for broken links monthly
- [ ] Keep dependencies updated: `npm update`

## ✅ Final Checklist

- [ ] All personal info updated
- [ ] All projects added with correct links
- [ ] All skills listed accurately
- [ ] Contact form configured
- [ ] All URLs verified and working
- [ ] Mobile responsiveness tested
- [ ] Page performance acceptable
- [ ] No console errors
- [ ] Site deployed and live
- [ ] Domain registered (optional)

---

**Congratulations! Your portfolio is ready to impress! 🎉**
