import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import VehicleForm from './pages/VehicleForm';
import Prestarts from './pages/Prestarts';
import PrestartDetail from './pages/PrestartDetail';
import Service from './pages/Service';
import ServiceForm from './pages/ServiceForm';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Vehicles": Vehicles,
    "VehicleDetail": VehicleDetail,
    "VehicleForm": VehicleForm,
    "Prestarts": Prestarts,
    "PrestartDetail": PrestartDetail,
    "Service": Service,
    "ServiceForm": ServiceForm,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};