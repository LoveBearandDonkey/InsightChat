import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { HelloScene } from "./scenes/HelloScene";
import { INTRO_FRAMES, LaunchVideo } from "./Video";
import { FPS, SHOTS, shotBaseFrames, TOTAL_FRAMES } from "./shots";

import { Shot1Dilemma } from "./scenes/Shot1Dilemma";
import { Shot2Expertise } from "./scenes/Shot2Expertise";
import { Shot3Context } from "./scenes/Shot3Context";
import { Shot4Ask } from "./scenes/Shot4Ask";
import { Shot5Reasoning } from "./scenes/Shot5Reasoning";
import { Shot6Backflow } from "./scenes/Shot6Backflow";
import { Shot7Partner } from "./scenes/Shot7Partner";
import { Shot8Finale } from "./scenes/Shot8Finale";

const SHOT_COMPONENTS: React.FC[] = [
  Shot1Dilemma,
  Shot2Expertise,
  Shot3Context,
  Shot4Ask,
  Shot5Reasoning,
  Shot6Backflow,
  Shot7Partner,
  Shot8Finale,
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />

      {/* 全片：空格播一遍看节奏。
          时长 = 正片 1440 帧 + 片头闪回 12 帧（v2 局部 15）。
          BGM 跟着片头一起后移，所以正片和音乐的对位没变 */}
      <Composition
        id="Launch"
        component={LaunchVideo}
        durationInFrames={TOTAL_FRAMES + INTRO_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />

      {/* 每镜单独注册，做某一镜时只选它，不用等前面几十秒 */}
      {SHOTS.map((shot, i) => (
        <Composition
          key={shot.key}
          id={`Shot${shot.n}-${shot.key}`}
          component={SHOT_COMPONENTS[i]}
          durationInFrames={shotBaseFrames(i)}
          fps={FPS}
          width={1920}
          height={1080}
        />
      ))}

      {/* D1 的闭环验证，留着当 still / render 的靶子 */}
      <Composition
        id="Hello"
        component={HelloScene}
        durationInFrames={90}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
