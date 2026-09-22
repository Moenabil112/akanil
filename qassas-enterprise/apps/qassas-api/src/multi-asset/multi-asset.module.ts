import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MultiAssetController } from "./multi-asset.controller";
import { MultiAssetService } from "./multi-asset.service";

@Module({
  imports: [AuthModule],
  controllers: [MultiAssetController],
  providers: [MultiAssetService],
})
export class MultiAssetModule {}
