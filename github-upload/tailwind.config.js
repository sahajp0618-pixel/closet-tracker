/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FBF6EC",
        paper: "#FFFDF8",
        ink: "#2E2620",
        muted: "#8A7E70",
        line: "#EBE2D2",
        coral: "#F0654E",
        candy: "#EC4899",
        sky: "#3B82F6",
        amber: "#F59E0B",
        grape: "#8B5CF6",
        leaf: "#22B37A"
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 2px 0 #EBE2D2, 0 10px 25px -12px rgba(46,38,32,0.25)",
        pop: "0 6px 0 rgba(46,38,32,0.12), 0 18px 40px -12px rgba(46,38,32,0.35)"
      },
      borderRadius: {
        xl2: "1.4rem"
      },
      keyframes: {
        popin: {
          "0%": { transform: "scale(0.94)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        flash: {
          "0%": { backgroundColor: "rgba(240,101,78,0.18)" },
          "100%": { backgroundColor: "transparent" }
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" }
        }
      },
      animation: {
        popin: "popin 0.18s ease-out",
        flash: "flash 0.9s ease-out",
        float: "float 4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
