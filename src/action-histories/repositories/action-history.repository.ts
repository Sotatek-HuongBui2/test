import {EntityRepository, Repository} from "typeorm";

import {ActionHistories} from "../../databases/entities/action_histories.entity";

@EntityRepository(ActionHistories)
export class ActionHistoryRepository extends Repository<ActionHistories> {

}
