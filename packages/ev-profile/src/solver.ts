import {
  EV_ENERGY_ABS_TOL_KWH,
  EV_SOLVER_MAX_PASSES,
} from "./constants";
import { infeasible } from "./errors";
import { nearlyEqual } from "./numeric";
import { simulateEvYearPass, type SimulateEvYearInput } from "./simulate";
import type { EvSolverGuards, EvYearPass } from "./types";

export const DEFAULT_EV_SOLVER_GUARDS: EvSolverGuards = {
  // First discarded pass may start from empty. This is a numerical seed,
  // not a claim that the customer begins January with an empty pack.
  initialEnergyKwh: 0,
  maxPasses: EV_SOLVER_MAX_PASSES,
  energyAbsTolKwh: EV_ENERGY_ABS_TOL_KWH,
};

/**
 * Repeated-year fixed-point warm-up until Eend ≈ Estart and annual
 * home / accepted-workplace totals are stable between consecutive passes.
 * Only the converged pass is returned. Each target year is solved alone.
 */
export function solveCyclicEvYear(
  yearInput: Omit<SimulateEvYearInput, "energyStartKwh">,
  guards: EvSolverGuards = DEFAULT_EV_SOLVER_GUARDS
): { pass: EvYearPass; solverPasses: number } {
  let start = guards.initialEnergyKwh;
  let previousHome = Number.NaN;
  let previousWorkplace = Number.NaN;

  for (let passIndex = 1; passIndex <= guards.maxPasses; passIndex++) {
    const pass = simulateEvYearPass({
      ...yearInput,
      energyStartKwh: start,
    });

    const cyclic = nearlyEqual(
      pass.energyEndKwh,
      pass.energyStartKwh,
      guards.energyAbsTolKwh
    );
    const totalsStable =
      passIndex === 1 ||
      (nearlyEqual(
        pass.homeChargedKwh,
        previousHome,
        guards.energyAbsTolKwh
      ) &&
        nearlyEqual(
          pass.workplaceAcceptedKwh,
          previousWorkplace,
          guards.energyAbsTolKwh
        ));

    if (cyclic && totalsStable) {
      if (pass.drivingUnservedKwh > guards.energyAbsTolKwh) {
        throw infeasible(
          "DRIVING_UNSERVED",
          "required driving energy cannot be served by the EV vehicle buffer",
          {
            drivingUnservedKwh: pass.drivingUnservedKwh,
            drivingServedKwh: pass.drivingServedKwh,
            energyStartKwh: pass.energyStartKwh,
            energyEndKwh: pass.energyEndKwh,
            solverPasses: passIndex,
          }
        );
      }
      return { pass, solverPasses: passIndex };
    }

    previousHome = pass.homeChargedKwh;
    previousWorkplace = pass.workplaceAcceptedKwh;
    start = pass.energyEndKwh;
  }

  throw infeasible(
    "SOLVER_NO_CONVERGENCE",
    "EV cyclic year solver did not converge within the implementation guard",
    {
      maxPasses: guards.maxPasses,
      energyAbsTolKwh: guards.energyAbsTolKwh,
    }
  );
}
