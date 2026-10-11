import { motion } from 'framer-motion';
import { ArrowRight, Mail } from 'lucide-react';

const Hero = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (i * 37) % 100,
    y: (i * 61) % 100,
    delay: (i % 5) * 0.1,
  }));

  return (
    <section className="min-h-screen flex items-center justify-center section-padding pt-20 pb-20">
      <div className="container-max text-center relative">
        {/* Animated particles background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-lime-300 rounded-full"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 4,
                delay: particle.delay,
                repeat: Infinity,
              }}
            />
          ))}
        </div>

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <motion.h1
            className="text-6xl md:text-7xl font-bold mb-6 neon-text font-display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 1 }}
          >
            Crafting Digital Experiences
          </motion.h1>

          <motion.p
            className="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            Full-stack developer passionate about building beautiful, performant web applications
          </motion.p>

          <motion.div
            className="flex gap-4 justify-center flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            <motion.a
              href="#projects"
              className="glow-button px-8 py-3 bg-lime-400 text-slate-950 font-semibold rounded-lg flex items-center gap-2 hover:bg-lime-300 smooth-transition"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              View My Work
              <ArrowRight size={20} />
            </motion.a>

            <motion.a
              href="#contact"
              className="px-8 py-3 border border-lime-400 text-lime-300 font-semibold rounded-lg hover:bg-lime-400 hover:text-slate-950 smooth-transition"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Get in Touch
            </motion.a>
          </motion.div>
        </motion.div>

        {/* Social icons */}
        <motion.div
          className="flex gap-4 justify-center mt-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
        >
          <SocialIcon href="https://github.com" icon={<Mail size={24} />} label="GitHub" />
          <SocialIcon href="https://linkedin.com" icon={<Mail size={24} />} label="LinkedIn" />
          <SocialIcon href="mailto:you@example.com" icon={<Mail size={24} />} label="Email" />
        </motion.div>
      </div>
    </section>
  );
};

const SocialIcon = ({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) => (
  <motion.a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    title={label}
    className="p-3 rounded-lg glass text-lime-300 hover:text-lime-200 hover:border-lime-300 smooth-transition"
    whileHover={{ y: -5 }}
    whileTap={{ scale: 0.95 }}
  >
    {icon}
  </motion.a>
);

export default Hero;
