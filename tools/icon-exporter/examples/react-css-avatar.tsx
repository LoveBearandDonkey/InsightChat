/**
 * 示例 1：React + CSS 动画
 * 覆盖组件库里最常见的形态 —— 纯 CSS keyframes 驱动，无需改一行代码即可导出。
 */
import React from "react";

export default function AvatarIcon({ hue = 214 }: { hue?: number }) {
  return (
    <div style={{ position: "relative", width: 200, height: 200 }}>
      <style>{`
        @keyframes ie-spin { to { transform: rotate(360deg); } }
        @keyframes ie-pulse {
          0%, 100% { transform: scale(1);    opacity: 1;   }
          50%      { transform: scale(1.14); opacity: .82; }
        }
        @keyframes ie-orbit { to { transform: rotate(-360deg); } }
      `}</style>

      {/* 外圈：渐变描边旋转 */}
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `conic-gradient(from 0deg, hsl(${hue} 90% 62%), hsl(${hue + 60} 90% 66%), transparent 70%)`,
          maskImage: "radial-gradient(circle, transparent 68%, #000 70%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 68%, #000 70%)",
          animation: "ie-spin 2s linear infinite",
        }}
      />
      {/* 内核：呼吸 */}
      <div
        style={{
          position: "absolute", inset: 44, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, hsl(${hue} 95% 74%), hsl(${hue + 24} 88% 52%))`,
          boxShadow: `0 0 24px hsl(${hue} 90% 60% / .55)`,
          animation: "ie-pulse 1.6s ease-in-out infinite",
        }}
      />
      {/* 卫星点：反向公转 */}
      <div style={{ position: "absolute", inset: 0, animation: "ie-orbit 2.4s linear infinite" }}>
        <div
          style={{
            position: "absolute", top: 6, left: "50%", marginLeft: -7,
            width: 14, height: 14, borderRadius: "50%",
            background: `hsl(${hue + 90} 92% 68%)`,
          }}
        />
      </div>
    </div>
  );
}
