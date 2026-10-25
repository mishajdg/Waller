/**
 * App — router (wouter)
 * ========================================================
 * "/" i "/admin" renderują TEN SAM komponent (MapPage) — "/admin" nie jest
 * osobną podstroną, to nadal mapa, tylko MapPage wewnętrznie sprawdza
 * window.location.pathname === "/admin" i pokazuje bramkę logowania /
 * panel admina. Trzeba więc zarejestrować oba path, inaczej wouter
 * przepuściłby "/admin" do NotFound.
 * "/zajecia" to nowy, osobny widok grafiku i zapisów na sekcje.
 */
import { Route, Switch } from "wouter";
import MapPage from "./pages/MapPage";
import ScheduleView from "./pages/ScheduleView";
import AdminSchedulePage from "./pages/AdminSchedulePage";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Switch>
      <Route path="/" component={MapPage} />
      <Route path="/admin" component={MapPage} />
      <Route path="/zajecia" component={ScheduleView} />
      <Route path="/admin/zajecia" component={AdminSchedulePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
