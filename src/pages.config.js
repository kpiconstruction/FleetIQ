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
import HighRiskWorkers from './pages/HighRiskWorkers';
import MaintenancePlanner from './pages/MaintenancePlanner';
import MaintenanceOverview from './pages/MaintenanceOverview';
import MaintenanceOperationalControl from './pages/MaintenanceOperationalControl';
import HireProviderPerformance from './pages/HireProviderPerformance';
import HireProviderDetail from './pages/HireProviderDetail';
import ServiceHistoryMigration from './pages/ServiceHistoryMigration';
import NotificationSettings from './pages/NotificationSettings';
import IncidentDetail from './pages/IncidentDetail';
import AutomationControl from './pages/AutomationControl';
import FuelImport from './pages/FuelImport';
import PrestartDefectDetail from './pages/PrestartDefectDetail';
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
    "HighRiskWorkers": HighRiskWorkers,
    "MaintenancePlanner": MaintenancePlanner,
    "MaintenanceOverview": MaintenanceOverview,
    "MaintenanceOperationalControl": MaintenanceOperationalControl,
    "HireProviderPerformance": HireProviderPerformance,
    "HireProviderDetail": HireProviderDetail,
    "ServiceHistoryMigration": ServiceHistoryMigration,
    "NotificationSettings": NotificationSettings,
    "IncidentDetail": IncidentDetail,
    "AutomationControl": AutomationControl,
    "FuelImport": FuelImport,
    "PrestartDefectDetail": PrestartDefectDetail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};