import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

interface Project {
  id: string;
  name: string;
}

interface ProjectContextType {
  selectedProject: Project | null;
  projects: Project[];
  loading: boolean;
  selectProject: (id: string) => void;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProjects = async () => {
    if (authLoading) return;

    const token = localStorage.getItem('token');
    if (!user || !token || user.role === 'BUYER') {
      setProjects([]);
      setSelectedProject(null);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/projects');
      setProjects(response.data);
      
      const savedProjectId = localStorage.getItem('selectedProjectId');
      if (savedProjectId) {
        const found = response.data.find((p: Project) => p.id === savedProjectId);
        if (found) setSelectedProject(found);
      } else if (response.data.length === 1) {
        setSelectedProject(response.data[0]);
        localStorage.setItem('selectedProjectId', response.data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, [user?.id, authLoading]);

  const selectProject = (id: string) => {
    const found = projects.find(p => p.id === id);
    if (found) {
      setSelectedProject(found);
      localStorage.setItem('selectedProjectId', id);
    }
  };

  return (
    <ProjectContext.Provider value={{ selectedProject, projects, loading, selectProject, refreshProjects }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
