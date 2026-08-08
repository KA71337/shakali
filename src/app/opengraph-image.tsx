import { ImageResponse } from "next/og";

export const alt =
  "Анонимное сообщение — напишите что-нибудь без регистрации";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at 20% 10%, rgba(124,58,237,0.34), transparent 38%), radial-gradient(circle at 86% 74%, rgba(8,145,178,0.2), transparent 36%), #070710",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.2,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        style={{
          width: 1040,
          height: 470,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "58px 64px",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 42,
          background: "rgba(15,15,31,0.82)",
          boxShadow: "0 30px 100px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 62,
              height: 62,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 20,
              border: "1px solid rgba(196,181,253,0.28)",
              background:
                "linear-gradient(145deg, rgba(139,92,246,0.32), rgba(255,255,255,0.04))",
              color: "#ddd6fe",
              fontSize: 34,
            }}
          >
            ···
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 25,
              fontWeight: 600,
              color: "#e2e8f0",
            }}
          >
            Без имени
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 1.03,
              letterSpacing: "-3.4px",
              fontWeight: 700,
            }}
          >
            Анонимное сообщение
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#a8b1c1",
            }}
          >
            Напишите что-нибудь. Регистрация не требуется.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 20,
            color: "#94a3b8",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              display: "flex",
              borderRadius: 999,
              background: "#6ee7b7",
              boxShadow: "0 0 16px rgba(110,231,183,0.7)",
            }}
          />
          Защищённая форма · до 1000 символов
        </div>
      </div>
    </div>,
    size,
  );
}
