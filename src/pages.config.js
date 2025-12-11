import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import VehicleForm from './pages/VehicleForm';
import Prestarts from './pages/Prestarts';
import PrestartDetail from './pages/PrestartDetail';
import Service from './pages/Service';
import ServiceForm from './pages/ServiceForm';
import Downtime from './pages/Downtime';
import DowntimeForm from './pages/DowntimeForm';
import Usage from './pages/Usage';
import Fuel from './pages/Fuel';
import HireProviders from './pages/HireProviders';
import Contracts from './pages/Contracts';
import WorkerRiskProfile from './pages/WorkerRiskProfile';
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
    "Downtime": Downtime,
    "DowntimeForm": DowntimeForm,
    "Usage": Usage,
    "Fuel": Fuel,
    "HireProviders": HireProviders,
    "Contracts": Contracts,
    "WorkerRiskProfile": WorkerRiskProfile,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};