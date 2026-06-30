import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AnimalsList from './pages/AnimalsList';
import AnimalNew from './pages/AnimalNew';
import AnimalDetail from './pages/AnimalDetail';
import Locations from './pages/Locations';
import LocationNew from './pages/LocationNew';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="animals" element={<AnimalsList />} />
        <Route path="animals/new" element={<AnimalNew />} />
        <Route path="animals/:id" element={<AnimalDetail />} />
        <Route path="locations" element={<Locations />} />
        <Route path="locations/new" element={<LocationNew />} />
      </Route>
    </Routes>
  );
}
