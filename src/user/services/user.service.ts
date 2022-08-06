import { BadRequestException, Injectable, UnauthorizedException, } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { plainToClass } from 'class-transformer';
import { ethers } from 'ethers';
import { createClient } from 'redis'
import { abi, TOKEN_SUPPORT } from 'src/common/Utils';
import { SpendingBalances } from 'src/databases/entities/spending_balances.entity';
import { KEY_SETTING } from 'src/settings/constants/key_setting';
import { SettingsService } from 'src/settings/services/settings.service';
import { OTP_TYPE, STATUS_OTP } from 'src/user-otp/constants/UserTypeOTP';
import { UserOtpService } from 'src/user-otp/services/user-otp.service';
import { Not } from "typeorm";
import { Connection } from 'typeorm';

import { NftAttributes } from "../../databases/entities/nft_attributes.entity";
import { User } from '../../databases/entities/user.entity';
import { UserCode } from "../../databases/entities/user_code.entity";
import { UserWalletHistory } from "../../databases/entities/user_wallet_histories.entity";
import {NftAttributesSevice} from "../../nft-attributes/nft-attributes.service";
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { UserCodeRepository } from "../../user-code/repositories/user-code.repository";
import { UserOtpRepository } from "../../user-otp/repositories/user-otp.repository";
import { KEY_GLOBAL_CONFIG } from '../constants';
import { ChangePasswordBodyDto } from '../dtos/change-password.dto';
import { CreateUserInput } from '../dtos/user-create-input.dto';
import { UserOutput } from '../dtos/user-output.dto';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
  constructor(
    private repository: UserRepository,
    private readonly logger: AppLogger,
    private readonly userOtpService: UserOtpService,
    private readonly userCodeRepository: UserCodeRepository,
    private readonly settingService: SettingsService,
    private readonly userOtpRepository: UserOtpRepository,
    private readonly nftAttributesService: NftAttributesSevice,

    private connection: Connection
  ) {
    this.logger.setContext(UserService.name);
  }

  async createUser(
    ctx: RequestContext,
    input: CreateUserInput,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.createUser.name} was called`);

    const user = plainToClass(User, input);

    user.password = await hash(input.password, 10);

    this.logger.log(ctx, `calling ${UserRepository.name}.saveUser`);
    await this.repository.save(user);

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async validateUsernamePassword(
    ctx: RequestContext,
    username: string,
    pass: string,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.validateUsernamePassword.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ name: username });
    if (!user) throw new UnauthorizedException();

    const match = await compare(pass, user.password);
    if (!match) throw new UnauthorizedException();

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async getUsers(
    ctx: RequestContext,
    limit: number,
    offset: number,
  ): Promise<{ users: UserOutput[]; count: number }> {
    this.logger.log(ctx, `${this.getUsers.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findAndCount`);
    const [users, count] = await this.repository.findAndCount({
      where: {},
      take: limit,
      skip: offset,
    });

    const usersOutput = plainToClass(UserOutput, users, {
      excludeExtraneousValues: true,
    });

    return { users: usersOutput, count };
  }

  async findById(ctx: RequestContext, id: number): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findById.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne(id);

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async getUserById(ctx: RequestContext, id: number): Promise<UserOutput> {
    this.logger.log(ctx, `${this.getUserById.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(id);

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async findByUsername(
    ctx: RequestContext,
    username: string,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findByUsername.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ name: username });

    return plainToClass(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.repository.findOne({ email });
    return plainToClass(User, user);
  }

  // async updateUser(
  //   ctx: RequestContext,
  //   userId: number,
  //   input: UpdateUserInput,
  // ): Promise<UserOutput> {
  //   this.logger.log(ctx, `${this.updateUser.name} was called`);

  //   this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
  //   const user = await this.repository.getById(userId);

  //   // Hash the password if it exists in the input payload.
  //   if (input.password) {
  //     input.password = await hash(input.password, 10);
  //   }

  //   // merges the input (2nd line) to the found user (1st line)
  //   const updatedUser: User = {
  //     ...user,
  //     ...plainToClass(User, input),
  //   };

  //   this.logger.log(ctx, `calling ${UserRepository.name}.save`);
  //   await this.repository.save(updatedUser);

  //   return plainToClass(UserOutput, updatedUser, {
  //     excludeExtraneousValues: true,
  //   });
  // }

  async getUserBalance(userId) {
    const userBalance = await SpendingBalances.find({
      where: { userId },
      order: {
        ['symbol']: 'ASC',
      },
    });
    if (!userBalance) {
      throw new BadRequestException('User balance does not exist');
    }
    return plainToClass(SpendingBalances, userBalance);
  }

  async verifyWallet(
    signedMessage: string,
    signer: string,
    user: User,
  ) {
    try {
      const userWallet = this.repository.findOne({ wallet: signer })
      const userById = this.repository.findOne({ id: user.id })
      const userOtp = await this.userOtpRepository.findOne({ where: { email: user.email, status: Not(STATUS_OTP.VERIFIED) }, order: { createdAt: "DESC" } })

      if (userOtp) {
        throw new BadRequestException('otp_not_verify');
      }
      const [userByWallet, userLogin] = await Promise.all([userWallet, userById])
      if (userByWallet && user.id != userByWallet.id) {
        throw new BadRequestException('wallet_already_mapping');
      }
      const message = process.env.MESSAGE_SIGN
      const signerAddress = ethers.utils.verifyMessage(message, signedMessage);

      // Create Transaction
      const queryRunner = this.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        if (signerAddress.toLowerCase() === signer) {
          if (!userLogin.wallet) {
            await queryRunner.manager.getRepository(User).update(user.id, { wallet: signer });
            const arrayToken = [
              { name: 'avax', address: process.env.AVAX_ADDRESS },
              { name: 'slgt', address: process.env.SLGT_ADDRESS },
              { name: 'slft', address: process.env.SLFT_ADDRESS },
            ];
            await this.insertSpendingBalances(arrayToken, signer, user.id, queryRunner);
            // await this.nftAttributesService.sendOneBedToUser(signer)
          }

          if (userLogin.wallet) {
            await this.updateUserWallet(user.id, signer.toLowerCase(), userLogin.wallet, queryRunner)
            const userWalletHistory = await this.insertUserWalletHistory(user.id, userLogin.wallet, signer.toLowerCase())
            await queryRunner.manager.save(userWalletHistory);
          }

          await queryRunner.commitTransaction();
        } else {
          throw new Error('incorrect_address');
        }
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        queryRunner.release();
      }

      return {
        status: true,
        message: "Verify Success"
      }
    }
    catch (error) {
      throw new BadRequestException(error);
    }
  }

  async insertSpendingBalances(arrayToken, wallet, userId, queryRunner) {
    const newSpendingBalances = []
    await arrayToken.forEach((token) => {
      newSpendingBalances.push({
        walletId: `${userId}${token.name}`,
        amount: '0',
        availableAmount: '0',
        userId,
        symbol: token.name.toLowerCase(),
        wallet: wallet.toLowerCase(),
        tokenAddress: token.address.toLowerCase()
      })
    });
    await queryRunner.manager.getRepository(SpendingBalances).insert(newSpendingBalances)
  }

  async changePassword(data: ChangePasswordBodyDto) {
    const { email, otp, newPassword, confirmPassword } = data;
    const userExist = await this.repository.findOne({ where: { email } });

    if (!userExist) throw new BadRequestException('User not exist');

    const bodyOtp = { otp, email, otpType: OTP_TYPE.CHANGE_PASS };
    const verifyOtp = await this.userOtpService.verifedOtpById(bodyOtp);

    if (verifyOtp === 'Fail') throw new BadRequestException('Invalid OTP');

    if (verifyOtp === 'Success') {
      if (confirmPassword !== newPassword)
        throw new BadRequestException('Confirm password wrong!');

      const password = await hash(newPassword, 10);
      await this.repository.update(userExist.id, {
        password,
      });
    }
  }

  async updateUserWallet(userId: number, wallet: string, oldWallet: string, queryRunner: any) {
    const user = await queryRunner.manager.getRepository(User).update({ id: userId }, { wallet: wallet });
    const spendingBalance = await queryRunner.manager.getRepository(SpendingBalances).update({ userId: userId }, { wallet: wallet });
    const nftUser = await queryRunner.manager.getRepository(NftAttributes).update({ owner: oldWallet }, { owner: wallet });
    return Promise.all([user, spendingBalance, nftUser])
  }

  async insertUserWalletHistory(userId: number, oldWallet: string, newWallet: string) {
    const userWalletHistory = UserWalletHistory.create({ userId, oldWallet, newWallet })
    return userWalletHistory
  }

  getActivationCode(ctx: RequestContext): Promise<UserCode[]> {
    return this.userCodeRepository.find({ where: { userId: ctx.user.id } })
  }

  async verifyWalletAddress(user, signedMessage, signer) {
    const message = process.env.MESSAGE_SIGN
    const signerAddress = ethers.utils.verifyMessage(message, signedMessage);
    if (signerAddress.toLowerCase() !== signer || user.wallet !== signerAddress.toLowerCase()) {
      throw new BadRequestException('incorrect_address');
    }
  }


  async setDataCatchToRedis(key: string, data: any) {
    const client = createClient()
    await client.connect();
    return await client.set(key, JSON.stringify(data));
  }

  async getDataCacheFromRedis(key: string) {
    const client = createClient()
    await client.connect();
    const data = await client.get(key);
    return JSON.parse(data)
  }

  async getGlobalConfig() {
    if (await this.getDataCacheFromRedis(KEY_GLOBAL_CONFIG)) {
      return await this.getDataCacheFromRedis(KEY_GLOBAL_CONFIG)
    } else {
      const enableActiveCode = await this.settingService.getSetting(KEY_SETTING.ENABLE_ACTIVE_CODE)
      const data = {
        contract: {
          contractTreasury: process.env.CONTRACT_TREASURY,
          contractMultisender: process.env.MULTISENDER
        },
        address: process.env.ADDRESS,
        isEnableActiveCode: !!Boolean(Number(enableActiveCode.value)),
        abi: abi,
        tokenSupport: TOKEN_SUPPORT,
        provider: process.env.PROVIDER,
        message_sign: process.env.MESSAGE_SIGN,
        nftAddress: {
          bed: process.env.BED_CONTRACT.toLowerCase(),
          bedbox: process.env.BED_BOX_CONTRACT.toLowerCase(),
          jewel: process.env.JEWEL_CONTRACT.toLowerCase(),
          item: process.env.ITEM_CONTRACT.toLowerCase()
        }
      }
      await this.setDataCatchToRedis(KEY_GLOBAL_CONFIG, data)
      return data
    }
  }
}
