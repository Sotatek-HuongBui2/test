import { Block } from "../entities/Block.entity";

class BlockService {
    public async createBlock(contract: string, blockNumber: number) {
        const data = Block.create({
            block: blockNumber,
            contract

        })
        return data.save()
    }

    public async getBlock() {
        return await Block.findOne({
            order: {
                block: 'DESC'
            }
        })
    }
}

export default new BlockService()
