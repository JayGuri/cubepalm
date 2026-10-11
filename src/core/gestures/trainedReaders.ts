import type { AngleThresholds, LearnedWeights, MarginThresholds } from './poseReaders'

// Written by research/sign-recognition.study.ts (`npm run research`). Do not edit by hand:
// change the study and run it again. See docs/research/sign-recognition.md.

export const TRAINED_ANGLE_THRESHOLDS: AngleThresholds = {"reach":0.5,"align":0.2}

export const TRAINED_MARGINS: MarginThresholds = {"raisedReach":0.747,"raisedAlign":0.648,"foldedReach":0.764}

export const TRAINED_WEIGHTS: LearnedWeights = {"features":[-0.6948,6.5429,-1.8018,0.1835,-0.4068],"bias":[-1.0277,-1.0266,-0.9827,-0.8766]}
