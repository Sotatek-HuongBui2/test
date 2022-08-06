import { remaintingTime } from "./services/checkRemaintingTime";

const CronJob = require('cron').CronJob;
export default class CheckRemainTime {
  public run = new CronJob(
    '* * * * *',
    async () => {
      await new remaintingTime().checkRemaintingTime();
    },
    null,
    true
  );
}
