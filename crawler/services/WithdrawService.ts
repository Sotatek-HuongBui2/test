import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { Connection, getConnection } from 'typeorm';
import { QueryRunner } from 'typeorm/query-runner/QueryRunner';

import { convertEtherToWei } from '../../src/common/Web3';
import {
  LOG_WITHDRAW_EVENTS,
  TX_WITHDRAW_STATUS,
  WITHDRAW_STATUS,
  WITHDRAW_TYPE,
} from '../../src/withdraw/constants';
import { ERC20, ERC721, MULTISENDER } from '../constants/abi';
import { NftAttributes } from '../entities/NftAttributes.entity';
import { SpendingBalances } from '../entities/SpendingBalance.entity';
import { TxWidthdrawl } from '../entities/TxWithdrawl.entity';
import { Withdraw } from '../entities/Withdraw.entity';

require('dotenv').config();
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER));
const MaxUint256: ethers.BigNumber = /*#__PURE__*/ ethers.BigNumber.from(
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
);
export default class WithdrawService {
  private adminWallet;
  private privateKey;
  private flagCheckTx;
  private flagWithdraw;
  private multiSenderContract;
  private static instance: WithdrawService;
  private connection: Connection;
  constructor() {
    this.adminWallet = process.env.OWNER_NFT_WALLET;
    this.privateKey = process.env.OWNER_NFT_PVK;
    this.multiSenderContract = process.env.MULTISENDER;
    this.flagCheckTx = false;
    this.flagWithdraw = false;
    this.connection = getConnection();
  }

  public static getInstance(): WithdrawService {
    if (!WithdrawService.instance) {
      WithdrawService.instance = new WithdrawService();
    }

    return WithdrawService.instance;
  }

  async handleWithdraw() {
    if (this.flagWithdraw) return;
    console.log('====================== run withdraw ========================');
    this.flagWithdraw = true;
    const iface = new ethers.utils.Interface(MULTISENDER);
    // Create Transaction
    const queryRunner = this.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tokenAvaxEndcodeParams = await this.getEndcodeParamsToken(
        process.env.AVAX_ADDRESS,
        queryRunner,
      );
      const tokenSLGTEndcodeParams = await this.getEndcodeParamsToken(
        process.env.SLGT_ADDRESS,
        queryRunner,
      );
      const tokenSLFTEndcodeParams = await this.getEndcodeParamsToken(
        process.env.SLFT_ADDRESS,
        queryRunner,
      );
      const nftBedEndcodeParams = await this.getEndcodeParamsNft(
        process.env.BED_CONTRACT,
        queryRunner,
      );
      const nftBedBoxEndcodeParams = await this.getEndcodeParamsNft(
        process.env.BED_BOX_CONTRACT,
        queryRunner,
      );
      const nftJewelEndcodeParams = await this.getEndcodeParamsNft(
        process.env.JEWEL_CONTRACT,
        queryRunner,
      );
      const nftItemEndcodeParams = await this.getEndcodeParamsNft(
        process.env.ITEM_CONTRACT,
        queryRunner,
      );

      const dataEndcodeTokenAvax = tokenAvaxEndcodeParams
        ? iface.encodeFunctionData('multiSenderToken', tokenAvaxEndcodeParams)
        : 0;
      const dataEndcodeTokenSLGT = tokenSLGTEndcodeParams
        ? iface.encodeFunctionData('multiSenderToken', tokenSLGTEndcodeParams)
        : 0;
      const dataEndcodeTokenSLFT = tokenSLFTEndcodeParams
        ? iface.encodeFunctionData('multiSenderToken', tokenSLFTEndcodeParams)
        : 0;
      const dataEndcodeNftBed = nftBedEndcodeParams
        ? iface.encodeFunctionData('multiSenderNFTs', nftBedEndcodeParams)
        : 0;
      const dataEndcodeNftBedBox = nftBedBoxEndcodeParams
        ? iface.encodeFunctionData('multiSenderNFTs', nftBedBoxEndcodeParams)
        : 0;
      const dataEndcodeNftJewel = nftJewelEndcodeParams
        ? iface.encodeFunctionData('multiSenderNFTs', nftJewelEndcodeParams)
        : 0;
      const dataEndcodeNftItem = nftItemEndcodeParams
        ? iface.encodeFunctionData('multiSenderNFTs', nftItemEndcodeParams)
        : 0;
      const arrEncode = [
        dataEndcodeTokenAvax,
        dataEndcodeNftBed,
        dataEndcodeNftBedBox,
        dataEndcodeNftItem,
        dataEndcodeTokenSLGT,
        dataEndcodeTokenSLFT,
        dataEndcodeNftJewel,
      ].filter((item) => item !== 0);

      if (arrEncode.length > 0) {
        const multiSender = new web3.eth.Contract(
          MULTISENDER,
          this.multiSenderContract,
        );

        const estimateGas = await multiSender.methods
          .multicall(arrEncode)
          .estimateGas({
            from: this.adminWallet,
            value: tokenAvaxEndcodeParams ? tokenAvaxEndcodeParams[1] : 0,
          });

        const data = await multiSender.methods.multicall(arrEncode).encodeABI();
        const details = {
          from: this.adminWallet,
          to: this.multiSenderContract,
          data,
          gas: estimateGas,
          value: tokenAvaxEndcodeParams ? tokenAvaxEndcodeParams[1] : 0,
        };
        const signedTx = await web3.eth.accounts.signTransaction(
          details,
          process.env.OWNER_NFT_PVK,
        );
        await web3.eth
          .sendSignedTransaction(signedTx.rawTransaction)
          .on('transactionHash', async (txSwapHash: string) => {
            await this.createTxWithdrawl(txSwapHash, queryRunner);
          });
      }
      await queryRunner.commitTransaction();
      this.flagWithdraw = false;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.flagWithdraw = false;
      throw error;
    }
    await this.checkTransaction(queryRunner);
    this.flagWithdraw = false;
  }

  async findSpendingBalance(userId: number, tokenAddress: string) {
    const spendingBalances = await SpendingBalances.findOne({
      userId,
      tokenAddress,
    });
    return spendingBalances;
  }

  async updateWithdrawStatus(id, queryRunner: QueryRunner) {
    await queryRunner.manager.getRepository(Withdraw).update(
      {
        status: WITHDRAW_STATUS.PENDING,
        id,
      },
      {
        status: WITHDRAW_STATUS.PROCESSING,
      },
    );
  }

  async changeOwnerNft(
    tokenId,
    contractAddress,
    newOwner,
    queryRunner: QueryRunner,
  ) {
    await queryRunner.manager
      .getRepository(NftAttributes)
      .update({ tokenId, contractAddress }, { owner: newOwner });
    await NftAttributes.update(
      { tokenId, contractAddress },
      { owner: newOwner },
    );
  }

  async getEndcodeParamsToken(contract: string, queryRunner: QueryRunner) {
    let amount = 0;
    const data = [];
    contract = contract.toLowerCase();
    const findWithdrawToken = await Withdraw.find({
      where: {
        status: WITHDRAW_STATUS.PENDING,
        type: WITHDRAW_TYPE.TOKEN,
        tokenAddress: contract,
      },
    });
    const updateStatus = [];

    if (findWithdrawToken && findWithdrawToken.length > 0) {
      for (const e of findWithdrawToken) {
        amount += Number(e.amount);
        data.push({
          reiciver: e.mainWallet,
          value: convertEtherToWei(web3, e.amount),
          id: e.id,
        });
        updateStatus.push(this.updateWithdrawStatus(e.id, queryRunner));
      }
    }

    if (amount === 0 || data.length == 0) return null;
    // Promise.all(updateStatus);

    return [contract, convertEtherToWei(web3, amount.toString()), data];
  }

  async getEndcodeParamsNft(contract: string, queryRunner: QueryRunner) {
    const data = [];
    contract = contract.toLowerCase();
    const findWithdrawNft = await Withdraw.find({
      where: {
        status: WITHDRAW_STATUS.PENDING,
        type: WITHDRAW_TYPE.NFT,
        contractAddress: contract,
      },
    });

    const updateStatus = [];
    if (findWithdrawNft && findWithdrawNft.length > 0) {
      for (const e of findWithdrawNft) {
        data.push({
          reiciver: e.mainWallet,
          value: e.tokenId,
          id: e.id,
        });
        updateStatus.push(this.updateWithdrawStatus(e.id, queryRunner));
      }
    }
    if (data.length == 0) return null;
    // Promise.all(updateStatus);
    return [contract, data];
  }

  async createTxWithdrawl(tx: string, queryRunner: QueryRunner) {
    const txWidthdrawl = new TxWidthdrawl();
    txWidthdrawl.tx = tx;
    txWidthdrawl.status = TX_WITHDRAW_STATUS.PROCESSING;
    await queryRunner.manager.getRepository(TxWidthdrawl).save(txWidthdrawl);
  }

  async checkTransaction(queryRunner: QueryRunner) {
    if (this.flagCheckTx) return;
    this.flagCheckTx = true;
    // Create Transaction
    await queryRunner.startTransaction();
    try {
      const txWithdrawl = await TxWidthdrawl.findOne({
        where: {
          status: TX_WITHDRAW_STATUS.PROCESSING,
        },
      });

      if (txWithdrawl) {
        await web3.eth
          .getTransactionReceipt(txWithdrawl.tx)
          .then(async (transaction) => {
            if (transaction.status) {
              try {
                txWithdrawl.status = TX_WITHDRAW_STATUS.SUCCESS;
                await queryRunner.manager
                  .getRepository(TxWidthdrawl)
                  .save(txWithdrawl);
                await this.getPastEventsMulti(
                  transaction.blockNumber,
                  txWithdrawl,
                  queryRunner,
                );
              } catch (error) {
                txWithdrawl.status = TX_WITHDRAW_STATUS.PROCESSING;
                await queryRunner.manager
                  .getRepository(TxWidthdrawl)
                  .save(txWithdrawl);
                console.log(error);
                this.flagCheckTx = false;
              }
            } else {
              txWithdrawl.status = TX_WITHDRAW_STATUS.FAILED;
              await queryRunner.manager
                .getRepository(TxWidthdrawl)
                .save(txWithdrawl);
            }
          });
        await queryRunner.commitTransaction();
      }
    } catch (error) {
      this.flagCheckTx = false;
      await queryRunner.rollbackTransaction();
      throw error;
    }
    this.flagCheckTx = false;
  }

  async getPastEventsMulti(
    blockNumber: string,
    txWithdrawl: TxWidthdrawl,
    queryRunner: QueryRunner,
  ) {
    const multi = new web3.eth.Contract(MULTISENDER, this.multiSenderContract);
    const options = {
      fromBlock: blockNumber,
      toBlock: blockNumber,
    };
    multi
      .getPastEvents('allEvents', options)
      .then((events) => {
        for (const event of events) {
          this.handleEvent(event, queryRunner);
        }
      })
      .catch((err) => {
        txWithdrawl.status = TX_WITHDRAW_STATUS.PROCESSING;
        this.flagCheckTx = false;
        throw err;
      });
  }

  async handleEvent(event: any, queryRunner: QueryRunner) {
    switch (event['event']) {
      case LOG_WITHDRAW_EVENTS.TOKEN:
        await this.handleWithdrawToken(event, queryRunner);
        break;
      case LOG_WITHDRAW_EVENTS.NFT:
        await this.handleWithdrawNft(event, queryRunner);
        break;
    }
  }
  async handleWithdrawToken(event: any, queryRunner: QueryRunner) {
    const txHash = event['transactionHash'];
    const { token, data } = event['returnValues'];
    for (const e of data) {
      const withdraw = await Withdraw.findOne({
        id: e.id,
        tokenAddress: token,
      });
      withdraw.status = WITHDRAW_STATUS.SUCCESS;
      withdraw.txHash = txHash;
      await queryRunner.manager.getRepository(Withdraw).save(withdraw);
      const spendingBalances = await this.findSpendingBalance(
        withdraw.userId,
        withdraw.tokenAddress,
      );
      spendingBalances.amount = new BigNumber(spendingBalances.amount)
        .minus(withdraw.amount)
        .toString();

      await queryRunner.manager
        .getRepository(SpendingBalances)
        .save(spendingBalances);
    }
  }
  async handleWithdrawNft(event: any, queryRunner: QueryRunner) {
    const txHash = event['transactionHash'];
    const { collection, data } = event['returnValues'];
    for (const e of data) {
      const withdraw = await Withdraw.findOne({
        id: e.id,
        contractAddress: collection,
      });
      withdraw.status = WITHDRAW_STATUS.SUCCESS;
      withdraw.txHash = txHash;
      await this.changeOwnerNft(
        withdraw.tokenId,
        withdraw.contractAddress,
        withdraw.mainWallet,
        queryRunner,
      );

      await queryRunner.manager.getRepository(Withdraw).save(withdraw);
    }
  }

  async handleApprove() {
    await this.approveToken(process.env.SLGT_ADDRESS);
    await this.approveToken(process.env.SLFT_ADDRESS);
    await this.approveNft(process.env.BED_CONTRACT);
    await this.approveNft(process.env.BED_BOX_CONTRACT);
    await this.approveNft(process.env.JEWEL_CONTRACT);
    await this.approveNft(process.env.ITEM_CONTRACT);
  }

  async approveToken(contract: string) {
    const erc20 = new web3.eth.Contract(ERC20, contract);
    const estimaseGas = await erc20.methods
      .approve(this.multiSenderContract, MaxUint256)
      .estimateGas({ from: this.adminWallet });
    web3.eth.accounts.wallet.add(this.privateKey);
    await erc20.methods
      .approve(this.multiSenderContract, MaxUint256)
      .send({ from: this.adminWallet, gas: estimaseGas });
  }

  async approveNft(contract: string) {
    const erc721 = new web3.eth.Contract(ERC721, contract);
    const estimaseGas = await erc721.methods
      .setApprovalForAll(this.multiSenderContract, true)
      .estimateGas({ from: this.adminWallet });
    await web3.eth.accounts.wallet.add(this.privateKey);
    await erc721.methods
      .setApprovalForAll(this.multiSenderContract, true)
      .send({ from: this.adminWallet, gas: estimaseGas });
  }
}
