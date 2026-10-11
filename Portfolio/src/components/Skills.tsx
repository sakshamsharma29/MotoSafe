import { motion } from 'framer-motion';

const skills = [
  {
    category: 'Frontend',
    items: ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Vue.js', 'Framer Motion'],
  },
  {
    category: 'Backend',
    items: ['Node.js', 'Express', 'Python', 'PostgreSQL', 'MongoDB', 'GraphQL'],
  },
  {
    category: 'Tools & Platforms',
    items: ['Git', 'Docker', 'AWS', 'Vercel', 'CI/CD', 'Jest'],
  },
  {
    category: 'UI/UX',
    items: ['Figma', 'Design Systems', 'Accessibility', 'Performance', 'Responsive Design', 'Animation'],
  },
];

const Skills = () => {
  return (
    <section id="skills" className="py-20 section-padding">
      <div className="container-max">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Skills & Expertise</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Technologies and practices I work with daily
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {skills.map((skillGroup, groupIndex) => (
            <motion.div
              key={skillGroup.category}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: groupIndex * 0.1 }}
              viewport={{ once: true }}
              className="glass rounded-lg p-6 hover:border-lime-400 smooth-transition"
            >
              <h3 className="text-lg font-bold text-lime-300 mb-4">{skillGroup.category}</h3>
              <div className="flex flex-wrap gap-2">
                {skillGroup.items.map((skill, index) => (
                  <motion.span
                    key={skill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: groupIndex * 0.1 + index * 0.05 }}
                    viewport={{ once: true }}
                    className="px-3 py-1 bg-slate-800 text-gray-200 rounded-full text-sm border border-slate-700 hover:border-lime-400 hover:text-lime-300 smooth-transition"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Skills;
