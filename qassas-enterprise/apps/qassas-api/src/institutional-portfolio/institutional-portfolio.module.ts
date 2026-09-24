import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { InstitutionalPortfolioController } from "./institutional-portfolio.controller";
import { InstitutionalPortfolioService } from "./institutional-portfolio.service";

@Module({
  imports: [DatabaseModule],
  controllers: [InstitutionalPortfolioController],
  providers: [InstitutionalPortfolioService],
  exports: [InstitutionalPortfolioService],
})
export class InstitutionalPortfolioModule {}
