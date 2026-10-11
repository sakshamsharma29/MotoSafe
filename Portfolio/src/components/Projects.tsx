import { motion } from 'framer-motion';
import { ExternalLink, Code2 } from 'lucide-react';

const projects = [
  {
    id: 1,
    title: 'E-Commerce Platform',
    description: 'Full-stack marketplace with real-time inventory, payment processing, and admin dashboard',
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&h=300&fit=crop',
    tags: ['React', 'Node.js', 'PostgreSQL', 'Stripe'],
    links: {
      github: 'https://github.com',
      demo: 'https://example.com',
    },
  },
  {
    id: 2,
    title: 'AI Chat Application',
    description: 'Real-time chat with AI integration, message history, and collaborative features',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&h=300&fit=crop',
    tags: ['React', 'WebSocket', 'OpenAI', 'Tailwind'],
    links: {
      github: 'https://github.com',
      demo: 'https://example.com',
    },
  },
  {
    id: 3,
    title: 'Data Analytics Dashboard',
    description: 'Interactive visualization dashboard with real-time data processing and custom reports',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500&h=300&fit=crop',
    tags: ['React', 'D3.js', 'Python', 'PostgreSQL'],
    links: {
      github: 'https://github.com',
      demo: 'https://example.com',
    },
  },
];

const Projects = () => {
  return (
    <section id="projects" className="py-20 section-padding bg-slate-900/30">
      <div className="container-max">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Featured Projects</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Showcase of recent work and side projects
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

const ProjectCard = ({
  project,
  index,
}: {
  project: (typeof projects)[0];
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.8, delay: index * 0.1 }}
    viewport={{ once: true }}
    className="group glass rounded-lg overflow-hidden hover:border-lime-400 smooth-transition hover:shadow-lg hover:shadow-lime-400/20"
  >
    {/* Image */}
    <div className="relative overflow-hidden h-48 bg-slate-800">
      <motion.img
        src={project.image}
        alt={project.title}
        className="w-full h-full object-cover"
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-60 group-hover:opacity-40 smooth-transition" />
    </div>

    {/* Content */}
    <div className="p-6">
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-lime-300 smooth-transition">
        {project.title}
      </h3>
      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{project.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {project.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-1 text-xs bg-slate-800 text-lime-300 rounded border border-lime-400/30"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Links */}
      <div className="flex gap-3 pt-4 border-t border-slate-700">
        <motion.a
          href={project.links.github}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-300 hover:text-lime-300 smooth-transition"
          whileHover={{ y: -2 }}
        >
          <Code2 size={16} />
          Code
        </motion.a>
        <motion.a
          href={project.links.demo}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-300 hover:text-lime-300 smooth-transition"
          whileHover={{ y: -2 }}
        >
          <ExternalLink size={16} />
          Demo
        </motion.a>
      </div>
    </div>
  </motion.div>
);

export default Projects;
