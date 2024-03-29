import { NotFoundException } from '@nestjs/common';
import { EntityRepository, Repository } from 'typeorm';

import { Article } from '../../databases/entities/article.entity';

@EntityRepository(Article)
export class ArticleRepository extends Repository<Article> {
  async getById(id: number): Promise<Article> {
    const article = await this.findOne(id);
    if (!article) {
      throw new NotFoundException();
    }

    return article;
  }
}
