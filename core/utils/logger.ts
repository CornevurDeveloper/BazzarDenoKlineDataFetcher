import {
  red,
  green,
  yellow,
  cyan,
  white,
  gray,
  bold,
} from "@std/fmt/colors";
import { DColors } from "../types.ts";
import { CONFIG } from "../../config.ts";

const colorMap: Record<string, (text: string) => string> = {
  [DColors.red]: red,
  [DColors.green]: green,
  [DColors.yellow]: yellow,
  [DColors.cyan]: cyan,
  [DColors.white]: white,
  [DColors.gray]: gray,
};

class Logger {
  private projectName = bold(CONFIG.PROJECT_NAME);

  private log(
    message: string,
    colorEnum: DColors,
    logFn: (msg: string) => void = console.log
  ) {
    const colorFunc = colorMap[colorEnum] || white;
    logFn(colorFunc(`[${this.projectName}] ${message}`));
  }

  public info(message: string, color: DColors): void {
    this.log(message, color, console.info);
  }

  public warn(message: string, color: DColors): void {
    this.log(message, color, console.warn);
  }

  public error(message: string, error?: unknown): void {
    const colorFunc = colorMap[DColors.red];
    console.error(colorFunc(bold(`[${this.projectName}] ✗ ERROR: ${message}`)));

    if (error) {
      if (error instanceof Error) {
        console.error(
          colorFunc(`[${this.projectName}]   Details: ${error.message}`)
        );
      } else {
        console.error(
          colorFunc(`[${this.projectName}]   Details: ${String(error)}`)
        );
      }
    }
  }

  public success(message: string, color: DColors): void {
    this.log(message, color, console.log);
  }
}

export const logger = new Logger();

