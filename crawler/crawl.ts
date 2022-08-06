import BaseCrawler from './BaseCrawler';
import CheckRemainTime from './checkRemainTime';
import { connectDB } from './database';
import ScheduleReward from './scheduleReward';

(async () => {
  await connectDB();
  const stacking = new ScheduleReward().run.start();
  const crawler = new BaseCrawler().scan();
  const remainTime = await new CheckRemainTime().run.start()
  await Promise.all([stacking, crawler, remainTime])
})();


