import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AnimalsList from './pages/AnimalsList';
import AnimalNew from './pages/AnimalNew';
import AnimalDetail from './pages/AnimalDetail';
import Locations from './pages/Locations';
import LocationNew from './pages/LocationNew';
import LocationEdit from './pages/LocationEdit';
import Import from './pages/Import';
import Planificacion from './pages/Planificacion';
import Analisis from './pages/Analisis';
import CargaPotreros from './pages/CargaPotreros';
import Reproductivo from './pages/Reproductivo';

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
        <Route path="locations/:id" element={<LocationEdit />} />
        <Route path="import" element={<Import />} />
        <Route path="tasks" element={<Planificacion />} />
        <Route path="analisis" element={<Analisis />} />
        <Route path="analisis/carga" element={<CargaPotreros />} />
        <Route path="analisis/reproductivo" element={<Reproductivo />} />
      </Route>
    </Routes>
  );
}
