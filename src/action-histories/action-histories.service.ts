import {Injectable} from '@nestjs/common';

import {ActionHistories} from "../databases/entities/action_histories.entity";
import {ACTION_INSERT_TYPE_DTO} from "./constants";
import {ActionHistoryRepository} from "./repositories/action-history.repository";

@Injectable()
export class ActionHistoriesService {
  constructor(private readonly actionHistoryRepository: ActionHistoryRepository) {
  }

  createNewHistory(dto: ACTION_INSERT_TYPE_DTO): Promise<ActionHistories> {
    return this.actionHistoryRepository.save(dto);
  }
}
