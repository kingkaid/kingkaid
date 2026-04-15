import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "./components/shared/AppShell";
import IndexPage from "./routes/index";
import XigaoPage from "./routes/xigao";
import AvatarPage from "./routes/avatar";
import ClipPage from "./routes/clip";
import MashupPage from "./routes/mashup";
import PipPage from "./routes/pip";
import SubtitlePage from "./routes/subtitle";
import CoverPage from "./routes/cover";
import BgmPage from "./routes/bgm";
import VoicePage from "./routes/voice";
import TitlePage from "./routes/title";
import CompliancePage from "./routes/compliance";
import AnalyzePage from "./routes/analyze";
import SettingsPage from "./routes/settings";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: IndexPage });
const xigaoRoute = createRoute({ getParentRoute: () => rootRoute, path: "/xigao", component: XigaoPage });
const avatarRoute = createRoute({ getParentRoute: () => rootRoute, path: "/avatar", component: AvatarPage });
const clipRoute = createRoute({ getParentRoute: () => rootRoute, path: "/clip", component: ClipPage });
const mashupRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mashup", component: MashupPage });
const pipRoute = createRoute({ getParentRoute: () => rootRoute, path: "/pip", component: PipPage });
const subtitleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/subtitle", component: SubtitlePage });
const coverRoute = createRoute({ getParentRoute: () => rootRoute, path: "/cover", component: CoverPage });
const bgmRoute = createRoute({ getParentRoute: () => rootRoute, path: "/bgm", component: BgmPage });
const voiceRoute = createRoute({ getParentRoute: () => rootRoute, path: "/voice", component: VoicePage });
const titleRoute = createRoute({ getParentRoute: () => rootRoute, path: "/title", component: TitlePage });
const complianceRoute = createRoute({ getParentRoute: () => rootRoute, path: "/compliance", component: CompliancePage });
const analyzeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/analyze", component: AnalyzePage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  xigaoRoute,
  avatarRoute,
  clipRoute,
  mashupRoute,
  pipRoute,
  subtitleRoute,
  coverRoute,
  bgmRoute,
  voiceRoute,
  titleRoute,
  complianceRoute,
  analyzeRoute,
  settingsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
