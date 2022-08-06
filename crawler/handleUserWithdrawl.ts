import { connectDB } from "./database";
import NftService from "./services/NftService";
import WithdrawService from "./services/WithdrawService";
require('dotenv').config()

async function handleRequestWithdraw() {
    console.log('----- Start handle withdraw -----');
    try {
        await WithdrawService.getInstance().handleWithdraw();
    } catch (e) {
        console.log(`handle withdraw error`, e);
    }
    console.log(`----- Handle withdraw END -----`);
    setTimeout(handleRequestWithdraw, 10000);
}

async function updateNftOnChain() {
    console.log('----- Start update nft on chain -----');
    try {
        await NftService.getInstance().mintNft();
    } catch (e) {
        console.log(`Update nft on chain error`, e);
    }
    console.log(`----- Update nft on chain END -----`);
    setTimeout(updateNftOnChain, 6000);
}

// async function checkTransaction() {
//     console.log(`----- Start check withdraw transaction -----`);
//     try {
//         await WithdrawService.getInstance().checkTransaction();
//     } catch (e) {
//         console.log(`check withdraw transaction error`, e);
//     }
//     console.log(`----- check withdraw transaction END -----`);
//     setTimeout(checkTransaction, 10000);
// }

const mainLoop = async function () {
    // await WithdrawService.getInstance().handleApprove();
    handleRequestWithdraw();
    // updateNftOnChain();
    // checkTransaction();
};

(async () => {
    await connectDB();
    await mainLoop();
})();
