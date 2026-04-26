import { useEffect, useState } from 'react';
import { 
  Building2, 
  Plus, 
  Settings, 
  Users, 
  ArrowRight
} from 'lucide-react';
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import CreateProjectModal from '../components/CreateProjectModal';

interface Project {
  id: string;
  name: string;
  configs: any[];
  _count?: {
    stands: number;
    admins: number;
  };
}

const ProjectManagement = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const { selectProject, refreshProjects } = useProject();
  const navigate = useNavigate();

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await api.get('/projects');
      setProjects(response.data);
      refreshProjects(); // Sync global project list
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Project Management</h1>
          <p className="text-secondary-400 mt-1">Configure and monitor all property development projects.</p>
        </div>
        {user?.role === 'SYSTEM_ADMIN' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20 active:scale-95"
          >
            <Plus size={20} />
            <span>Create New Project</span>
          </button>
        )}
      </div>

      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchProjects} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="glass p-8 rounded-3xl animate-pulse h-64 bg-white/5"></div>
          ))
        ) : projects.map((project) => (
          <div key={project.id} className="glass p-8 rounded-3xl border border-white/10 hover:border-primary-500/50 hover:bg-white/5 transition-all group flex flex-col justify-between h-64">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-primary-600/20 rounded-2xl flex items-center justify-center text-primary-500">
                  <Building2 size={24} />
                </div>
                <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                  Active
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2">{project.name}</h3>
              <div className="flex items-center gap-4 text-secondary-400 text-sm">
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-4">
                  <Building2 size={14} className="text-secondary-500" />
                  <span>Real Estate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={14} />
                  <span>{project._count?.stands || 0} Stands</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/5 mt-auto">
              <button className="text-secondary-400 hover:text-white transition-colors">
                <Settings size={20} />
              </button>
              <button 
                onClick={() => {
                  selectProject(project.id);
                  navigate('/');
                }}
                className="flex items-center gap-2 text-primary-500 font-bold hover:translate-x-1 transition-all"
              >
                Project Dashboard
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ))}
        
        {!loading && projects.length === 0 && (
          <div className="col-span-full py-20 glass rounded-3xl text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 size={40} className="text-secondary-600" />
            </div>
            <h3 className="text-2xl font-bold">No Projects Found</h3>
            <p className="text-secondary-500 mt-2">You don't have access to any projects yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectManagement;
