import { motion } from 'framer-motion';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="border-t border-slate-800 py-12 section-padding bg-slate-950/50"
    >
      <div className="container-max">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <p className="text-gray-400 text-sm">
              © {currentYear} Your Name. All rights reserved.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="flex gap-6 text-sm text-gray-400"
          >
            <a href="#" className="hover:text-lime-300 smooth-transition">
              Privacy
            </a>
            <span>•</span>
            <a href="#" className="hover:text-lime-300 smooth-transition">
              Terms
            </a>
            <span>•</span>
            <a href="mailto:you@example.com" className="hover:text-lime-300 smooth-transition">
              Contact
            </a>
          </motion.div>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;
