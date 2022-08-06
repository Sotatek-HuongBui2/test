import {Injectable} from '@nestjs/common';
import _ from 'lodash';
import moment from 'moment';
import {TrackingResult} from 'src/databases/entities/tracking-result.entity';
import {HealthAppDataRepository} from 'src/health-app-data/health-app-data.repository';
import {Between} from "typeorm";

import {TrackingResultRepository} from './tracking-result.repository';

interface Chart {
  t: number, // end date of point
  v: number, // value point
  s: number, // start date of point
  type?: string // type SLEEP_AWAKE / SLEEP_DEEP / SLEEP_LIGHT
}

interface ChartWeek {
  t: number, // end date of point
  v: number | string, // value point
}

export interface IChartDay {
  token_earn: string;
  token_earn_symbol: string;
  score: number;
  bed_time: number;
  onset_time: number
  woke_up: number;
  time_in_bed: number;
  sleep_duration: number;
  noctural_awaken: number;
  score_percent: string
  chart_data: Array<Chart>
}

export interface IChartWeekMonth {
  slft_chart: Array<ChartWeek>;
  sleep_score_chart: Array<ChartWeek>;
  bed_time_chart: Array<ChartWeek>;
  sleep_onset_chart: Array<ChartWeek>;
  woke_up_chart: Array<ChartWeek>;
  sleep_duration_chart: Array<ChartWeek>;
  time_in_bed_chart: Array<ChartWeek>;
  noctural_awaken_chart: Array<ChartWeek>;
}

@Injectable()
export class TrackingResultSevice {
  constructor(
    private readonly trackingResultRepository: TrackingResultRepository,
    private readonly heathAppRepo: HealthAppDataRepository
  ) {
  }

  async getTrackingResult(userId, date, type) {
    let thisTime
    let preTime

    const query = this.trackingResultRepository.createQueryBuilder('tr')
      .select([
        'sum(tr.sleepDurationTime) as sleepDurationTime',
        'sum(tr.actualEarn) as actualEarn',
        'sum(tr.bedTime) as betTime',
        'sum(tr.sleepOnsetTime) as sleepOnsetTime',
        'sum(tr.wokeUpTime) as wokeUpTime',
        'sum(tr.sleepQuality) as sleepQuality',
      ])
      .where('tr.userId = :userId', {userId})
      .orderBy('tr.dateTime', 'ASC')

    if (type === 'day') {
      thisTime = moment(date).endOf('day').toDate()
      preTime = moment(date).startOf('day').toDate()
      query.addSelect('tr.dateTime as date')
        .andWhere('tr.dateTime BETWEEN :preTime and :thisTime', {preTime, thisTime})
        .groupBy('HOUR(tr.date_time)')
      const chart = await query.getRawMany()
      const total = {
        totalSleepDurationTime: 0,
        totalActualEarn: 0,
        totalBedTime: 0,
        totalSleepOnsetTime: 0,
        totalWokeUpTime: 0,
        totalSleepQuality: 0
      }
      for (const item of chart) {
        total.totalSleepDurationTime += +item.sleepDurationTime
        total.totalActualEarn += +item.actualEarn
        total.totalBedTime += +item.betTime
        total.totalSleepOnsetTime += +item.sleepOnsetTime
        total.totalWokeUpTime += +item.wokeUpTime
        total.totalSleepQuality += +item.sleepQuality
      }
      return {chart, total}
    } else if (type === 'week') {
      thisTime = moment(date).endOf('day').toDate()
      preTime = moment(date).subtract(7, 'days').startOf('day').toDate()
      query
        .addSelect('tr.dateTime as date')
        .andWhere('tr.dateTime BETWEEN :preTime and :thisTime', {preTime, thisTime})
        .groupBy('DAY(tr.date_time)')
    } else if (type === 'month') {
      thisTime = moment(date).endOf('day').format('YYYY-MM-DD')
      preTime = moment(date).subtract(1, 'months').startOf('day').format('YYYY-MM-DD')
      const chartMonth = await query
        .addSelect('tr.dateTime as date')
        .andWhere('tr.dateTime BETWEEN :preTime and :thisTime', {preTime, thisTime})
        .groupBy('DAY(tr.date_time)')
        .getRawMany()

      const result = []
      const arrChartMonth = _.chunk(chartMonth, 3)
      arrChartMonth.map((item) => {
        const value = {
          sleepDurationTime: 0,
          actualEarn: 0,
          betTime: 0,
          sleepOnsetTime: 0,
          wokeUpTime: 0,
          sleepQuality: 0,
          date: ''
        }
        item.map((e) => {
          value.sleepDurationTime += e.sleepDurationTime
          value.actualEarn += e.actualEarn
          value.betTime += e.betTime
          value.sleepOnsetTime += e.sleepOnsetTime
          value.wokeUpTime += e.wokeUpTime
          value.sleepQuality += e.sleepQuality
        })
        value.date = item[item.length - 1].date
        result.push(value)
      })

      return result

    }

    query.andWhere('DAY(tr.date_time)')

    return query.getRawMany()
  }


  async getChartData(userId: number, type: string, fDate: string, tDate: string): Promise<IChartDay | IChartWeekMonth> {
    if (type === 'day') {
      let resData: IChartDay = {
        token_earn: '0',
        token_earn_symbol: 'SLFT',
        score: 0,
        bed_time: 0,
        onset_time: 0,
        woke_up: 0,
        time_in_bed: 0,
        sleep_duration: 0,
        noctural_awaken: 0,
        score_percent: '',
        chart_data: new Array<Chart>()
      };

      const dataTracking = await this.trackingResultRepository
        .createQueryBuilder('tr')
        .where('Date(tr.date_time) = :date', {date: moment(fDate).format('YYYY-MM-DD')})
        .andWhere('tr.user_id = :user_id', {user_id: userId})
        .orderBy('tr.createdAt', 'DESC')
        .getOne();

      if (dataTracking) {
        const chartData = await this.getChartDataByDay(dataTracking.trackingId);
        resData = {
          token_earn: dataTracking.actualEarn,
          token_earn_symbol: 'SLFT',
          score: dataTracking.sleepQuality,
          bed_time: Number(dataTracking.startSleepTime),
          onset_time: Number(dataTracking.sleepOnsetTime),
          woke_up: Number(dataTracking.wokeUpTime),
          time_in_bed: Number(dataTracking.bedTime),
          sleep_duration: Number(dataTracking.sleepDurationTime),
          noctural_awaken: dataTracking.nAwk,
          score_percent: Math.floor(dataTracking.sleepQuality / 100).toFixed(2),
          chart_data: chartData
        };
        return resData;
      }
      return resData;
    }

    // query data with chart is week, month, custom.
    let fDStr = moment(fDate).format('YYYY-MM-DD');
    let tDStr = moment(tDate).format('YYYY-MM-DD');

    if (type === 'month') {
      fDStr = moment().startOf('month').format('YYYY-MM-DD');
      tDStr = moment().format('YYYY-MM-DD');
    }

    const dataTrackingList = await this.trackingResultRepository
      .createQueryBuilder('tr')
      .where('Date(tr.date_time) >= :fD AND Date(tr.date_time) <= :tD', {fD: fDStr, tD: tDStr})
      .andWhere('tr.user_id = :user_id', {user_id: userId})
      .getMany();

    const trackingIds = dataTrackingList.map(x => x.trackingId);
    return await this.getChartDataByWeek(dataTrackingList, trackingIds, fDStr, tDStr);
  }

  async getChartDataByDay(trackingId: number): Promise<Array<Chart>> {
    const res = Array<Chart>();
    const arrayTime = await this.heathAppRepo
      .createQueryBuilder('h')
      .where('h.tracking_id = :trackingId', {trackingId: trackingId})
      .orderBy('h.date_from', 'ASC')
      .getMany();

    for (const item of arrayTime) {
      res.push({
        s: moment(item.dateFrom).unix(),
        t: moment(item.dateTo).unix(),
        type: item.dataType,
        v: parseInt(item.value)
      })
    }
    return res;
  }

  async getChartDataByWeek(dataTrackingList: Array<TrackingResult>, trackingIds: Array<number>, dateFrom: string, dateTo: string): Promise<IChartWeekMonth> {
    const res: IChartWeekMonth = {
      slft_chart: new Array<ChartWeek>(),
      sleep_score_chart: new Array<ChartWeek>(),
      bed_time_chart: new Array<ChartWeek>(),
      sleep_onset_chart: new Array<ChartWeek>(),
      woke_up_chart: new Array<ChartWeek>(),
      sleep_duration_chart: new Array<ChartWeek>(),
      time_in_bed_chart: new Array<ChartWeek>(),
      noctural_awaken_chart: new Array<ChartWeek>(),
    }

    // loop date and set data for chart
    const end = new Date(dateTo);
    let loop = new Date(dateFrom);

    while (loop <= end) {
      const time = moment(loop).format('YYYY-MM-DD');
      const dataResult: any = dataTrackingList.length ? dataTrackingList.find(x => moment(x?.dateTime).format('YYYY-MM-DD') === time) : {};
      const t = moment(loop).unix();

      // push data result list
      res.slft_chart.push({
        t,
        v: Number(dataResult?.actualEarn || 0)
      });

      res.sleep_score_chart.push({
        t,
        v: Number(dataResult?.sleepQuality || 0)
      });

      res.bed_time_chart.push({
        t,
        v: dataResult?.startSleepTime
      });

      res.sleep_onset_chart.push({
        t,
        v: dataResult?.sleepOnsetTime
      });

      res.woke_up_chart.push({
        t,
        v: dataResult?.wokeUpTime
      });

      res.sleep_duration_chart.push({
        t,
        v: dataResult?.sleepDurationTime
      });

      res.time_in_bed_chart.push({
        t,
        v: Number(dataResult?.timeInBed || 0)
      });

      res.noctural_awaken_chart.push({
        t,
        v: Number(dataResult?.nAwk || 0)
      });
      const newDate = loop.setDate(loop.getDate() + 1);
      loop = new Date(newDate);
    }
    return res;
  }

  totalEarnTodayByUser(userId: number): Promise<{total: number}> {
    return this.trackingResultRepository
      .createQueryBuilder('tr')
      .select('sum(tr.actual_earn) as total')
      .where({
        userId,
        createdAt: Between(
          moment()
            .startOf('days')
            .format('YYYY-MM-DD HH:mm:ss'),
          moment()
            .endOf('days')
            .format('YYYY-MM-DD HH:mm:ss')
        )
      })
      .getRawOne()
  }
}
