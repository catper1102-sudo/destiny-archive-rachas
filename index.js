// ================= IMPORTS =================
import express from "express";
import fs from "fs";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActivityType,
} from "discord.js";

import { initMusic, handleMusicInteraction } from "./music.js";

// ================= CONFIG =================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1448457475148746762";
const GUILD_ID = "1442310580546572431";

const STAFF_ROLES = [
  "1442360350229004469",
  "1442360123098927134",
  "1442359882748530738",
  "1442361232559706174",
];

// ================= ARCHIVOS =================
const RACHAS_FILE = "./rachas.json";
const INTER_FILE = "./interacciones.json";

// ================= FUNCIONES JSON =================
const readJSON = (path) => {
  if (!fs.existsSync(path)) fs.writeFileSync(path, "{}");
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch {
    fs.writeFileSync(path, "{}");
    return {};
  }
};
const writeJSON = (path, data) =>
  fs.writeFileSync(path, JSON.stringify(data, null, 2));

let rachas = readJSON(RACHAS_FILE);
let interacciones = readJSON(INTER_FILE);

// ================= FUNCIONES AUX =================
const hoy = () => Math.floor(Date.now() / 86400000);

function actualizarRacha(usuarioId) {
  const today = hoy();
  if (!rachas[usuarioId]) rachas[usuarioId] = { streak: 1, lastDay: today };
  else if (rachas[usuarioId].lastDay !== today) {
    rachas[usuarioId].streak =
      rachas[usuarioId].lastDay === today - 1
        ? rachas[usuarioId].streak + 1
        : 1;
    rachas[usuarioId].lastDay = today;
  }
  writeJSON(RACHAS_FILE, rachas);
}

function actualizarInteraccion(autorId, targetId, cmd) {
  if (!interacciones[autorId]) interacciones[autorId] = {};
  if (!interacciones[autorId][targetId]) interacciones[autorId][targetId] = {};
  if (!interacciones[autorId][targetId][cmd])
    interacciones[autorId][targetId][cmd] = 0;
  interacciones[autorId][targetId][cmd] += 1;
  writeJSON(INTER_FILE, interacciones);
}

// ================= WAIFU GIFS =================
const WAIFU_ACTIONS = [
  "abrazar",
  "besar",
  "acariciar",
  "golpear",
  "acurrucar",
  "pinchar",
  "morder",
  "choquedemanos",
  "saludar",
  "sonrojar",
  "sonreir",
  "bailar",
];

const WAIFU_GIFS = {
  abrazar: [
    "https://i.imgur.com/od5H3Pm.gif",
    "https://i.imgur.com/L2z7dnO.gif",
    "https://i.imgur.com/3o6ZtaO.gif",
  ],
  besar: ["https://i.imgur.com/G3va31o.gif", "https://i.imgur.com/1lhqvTq.gif"],
  acariciar: [
    "https://i.imgur.com/L2z7dnO.gif",
    "https://i.imgur.com/3o6ZtaO.gif",
  ],
  golpear: [
    "https://i.imgur.com/4Z3g2lC.gif",
    "https://i.imgur.com/3o6ZsZ8.gif",
  ],
  acurrucar: [
    "https://i.imgur.com/3o6ZtaO.gif",
    "https://i.imgur.com/L2z7dnO.gif",
  ],
  pinchar: ["https://i.imgur.com/3oEjI6S.gif"],
  morder: [
    "https://i.imgur.com/10dU7AN.gif",
    "https://i.imgur.com/2K3V8rO.gif",
  ],
  choquedemanos: ["https://i.imgur.com/3o6Zt481.gif"],
  saludar: ["https://i.imgur.com/3oKIPwo.gif"],
  sonrojar: ["https://i.imgur.com/3o6ZsZ8.gif"],
  sonreir: ["https://i.imgur.com/l4FGI8G.gif"],
  bailar: ["https://i.imgur.com/3o6ZsX5.gif"],
};

const usedGifs = {};
function getGif(action) {
  if (!WAIFU_GIFS[action]) return null;
  if (!usedGifs[action]) usedGifs[action] = [];
  const available = WAIFU_GIFS[action].filter(
    (g) => !usedGifs[action].includes(g),
  );
  let gif;
  if (available.length === 0) {
    usedGifs[action] = [];
    gif =
      WAIFU_GIFS[action][Math.floor(Math.random() * WAIFU_GIFS[action].length)];
  } else {
    gif = available[Math.floor(Math.random() * available.length)];
  }
  usedGifs[action].push(gif);
  return gif;
}

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

// Inicializar música
initMusic(client);

// ================= COMANDOS =================
const commands = [
  ...WAIFU_ACTIONS.map((a) =>
    new SlashCommandBuilder()
      .setName(a)
      .setDescription(`Interacción anime: ${a}`)
      .addUserOption((o) =>
        o
          .setName("usuario")
          .setDescription("Usuario objetivo")
          .setRequired(true),
      ),
  ),
  new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Compatibilidad entre dos usuarios")
    .addUserOption((u) =>
      u.setName("usuario1").setDescription("Usuario 1").setRequired(true),
    )
    .addUserOption((u) =>
      u.setName("usuario2").setDescription("Usuario 2").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("racha")
    .setDescription("Ver tu racha o la de otro usuario")
    .addUserOption((o) =>
      o
        .setName("usuario")
        .setDescription("Usuario objetivo")
        .setRequired(false),
    ),
  new SlashCommandBuilder().setName("topracha").setDescription("Top 10 rachas"),
  new SlashCommandBuilder()
    .setName("sumaracha")
    .setDescription("Sumar racha (Staff)")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("dias").setDescription("Días a sumar").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("restaracha")
    .setDescription("Restar racha (Staff)")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("dias").setDescription("Días a restar").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("fijaracha")
    .setDescription("Fijar racha exacta (Staff)")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario").setRequired(true),
    )
    .addIntegerOption((o) =>
      o.setName("dias").setDescription("Días exactos").setRequired(true),
    ),
  // Música
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Reproducir música (YouTube/Spotify/nombre)")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription("Nombre o link de canción")
        .setRequired(true),
    ),
  new SlashCommandBuilder().setName("skip").setDescription("Saltar canción"),
  new SlashCommandBuilder().setName("stop").setDescription("Detener música"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Ver cola de música"),
].map((c) => c.toJSON());

// ================= REGISTRO COMANDOS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log("✅ Comandos registrados correctamente");
  } catch (e) {
    console.error("❌ Error registrando comandos:", e);
  }
})();

// ================= EVENTOS =================
client.on("messageCreate", (m) => {
  if (m.author.bot || !m.guild) return;
  actualizarRacha(m.author.id);
});

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    // Música
    if (["play", "skip", "stop", "queue"].includes(i.commandName)) {
      return handleMusicInteraction(i);
    }

    // WAIFU
    if (WAIFU_ACTIONS.includes(i.commandName)) {
      const target = i.options.getUser("usuario");
      actualizarInteraccion(i.user.id, target.id, i.commandName);
      const gif = getGif(i.commandName);
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `${i.user.username} ${i.commandName} a ${target.username}`,
            )
            .setDescription("Interacción anime realizada!")
            .setImage(gif)
            .setColor("#1F1F1F")
            .setFooter({ text: "Midnight Reverie" }),
        ],
      });
    }

    // SHIP
    if (i.commandName === "ship") {
      const u1 = i.options.getUser("usuario1");
      const u2 = i.options.getUser("usuario2");
      const compat = Math.floor(Math.random() * 101);
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`💖 Compatibilidad ${u1.username} & ${u2.username}`)
            .setDescription(`**${compat}%** compatible!`)
            .setColor("#FF69B4"),
        ],
      });
    }

    // Rachas
    if (i.commandName === "racha") {
      const target = i.options.getUser("usuario") || i.user;
      actualizarRacha(target.id);
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`📊 Racha de ${target.username}`)
            .setDescription(
              `Racha actual: **${rachas[target.id].streak}** días`,
            )
            .setColor("#1F1F1F"),
        ],
      });
    }

    if (i.commandName === "topracha") {
      const sorted = Object.entries(rachas)
        .sort((a, b) => b[1].streak - a[1].streak)
        .slice(0, 10);
      const description =
        sorted.map(([id, r]) => `<@${id}>: **${r.streak}** días`).join("\n") ||
        "No hay rachas";
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏆 Top 10 Rachas")
            .setDescription(description)
            .setColor("#FFD700"),
        ],
      });
    }

    // STAFF
    if (["sumaracha", "restaracha", "fijaracha"].includes(i.commandName)) {
      if (!i.member.roles.cache.some((r) => STAFF_ROLES.includes(r.id)))
        return i.reply({ content: "❌ No tienes permisos.", ephemeral: true });
      const target = i.options.getUser("usuario");
      const dias = i.options.getInteger("dias");
      if (!rachas[target.id]) rachas[target.id] = { streak: 0, lastDay: hoy() };
      if (i.commandName === "sumaracha") rachas[target.id].streak += dias;
      if (i.commandName === "restaracha") rachas[target.id].streak -= dias;
      if (i.commandName === "fijaracha") rachas[target.id].streak = dias;
      writeJSON(RACHAS_FILE, rachas);
      return i.reply({
        content: `✅ Racha de <@${target.id}> actualizada a **${rachas[target.id].streak}** días`,
        ephemeral: true,
      });
    }
  } catch (e) {
    console.error("Error interactionCreate:", e);
    if (i.deferred || i.replied) return i.editReply("❌ Ocurrió un error.");
    return i.reply({ content: "❌ Ocurrió un error.", ephemeral: true });
  }
});

// ================= READY =================
client.once("ready", () => {
  console.log(`🟣 Conectado como ${client.user.tag}`);
  client.user.setActivity("interacciones anime 🎵", {
    type: ActivityType.Watching,
  });
});

// ================= WEB 24/7 =================
const app = express();
app.get("/", (_, res) => res.send("Bot online 24/7"));
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Servidor web activo"),
);

// ================= LOGIN =================
client.login(TOKEN);
