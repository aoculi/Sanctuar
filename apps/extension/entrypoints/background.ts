import { BackgroundService } from "./lib/backgroundService";

export default defineBackground(() => {
  const service = new BackgroundService();
  service.initialize();
});
