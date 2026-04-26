import { useAuth } from '../contexts/AuthContext';
import Dashboard from '../pages/Dashboard';
import PurchaserDashboard from '../pages/PurchaserDashboard';

const HomeRoute = () => {
  const { user } = useAuth();

  if (user?.role === 'BUYER') {
    return <PurchaserDashboard />;
  }

  return <Dashboard />;
};

export default HomeRoute;
