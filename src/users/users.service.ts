import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(name: string, email: string, passwordHash: string): Promise<UserDocument> {
    const user = new this.userModel({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'member',
      plan: 'free',
      isActive: true,
    });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateRefreshTokenHash(id: string, hash: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      id,
      { refreshTokenHash: hash },
      { returnDocument: 'after' },
    ).exec();
  }

  async clearRefreshTokenHash(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { $unset: { refreshTokenHash: 1 } }).exec();
  }

  async deactivate(id: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(
      id,
      { isActive: false, $unset: { refreshTokenHash: 1 } },
    ).exec();
  }
}
