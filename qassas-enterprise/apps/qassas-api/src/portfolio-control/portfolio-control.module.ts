import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PortfolioControlController } from "./portfolio-control.controller";
import { PortfolioControlService } from "./portfolio-control.service";

@Module({
  imports: [AuthModule],
  controllers: [PortfolioControlController],
  providers: [PortfolioControlService],
})
export class PortfolioControlModule {}
