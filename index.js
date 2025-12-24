const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActivityType,
} = require("discord.js");
const fs = require("fs");
const express = require("express");

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

// ================= ARCHIVO =================
const FILE = "./rachas.json";
if (!fs.existsSync(FILE) || fs.readFileSync(FILE, "utf8").trim() === "") {
  fs.writeFileSync(FILE, "{}");
}
let rachas = JSON.parse(fs.readFileSync(FILE, "utf8"));

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ================= FECHAS =================
function hoy() {
  return new Date().toISOString().slice(0, 10);
}
function ayer() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("racha")
    .setDescription("Ver la racha de un usuario")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario a consultar"),
    ),

  new SlashCommandBuilder()
    .setName("toprachas")
    .setDescription("Ver el top de rachas"),

  new SlashCommandBuilder()
    .setName("resetrachas")
    .setDescription("Reiniciar rachas (solo staff)")
    .addUserOption((o) =>
      o.setName("usuario").setDescription("Usuario a reiniciar"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((c) => c.toJSON());

// ================= REGISTRO =================
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands,
  });
  console.log("✅ Comandos registrados");
})();

// ================= RACHAS AUTOMÁTICAS =================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const today = hoy();

  if (!rachas[userId]) rachas[userId] = { streak: 0, lastDay: null };
  const data = rachas[userId];

  if (data.lastDay === today) return;

  if (data.lastDay === ayer()) data.streak += 1;
  else data.streak = 1;

  data.lastDay = today;
  fs.writeFileSync(FILE, JSON.stringify(rachas, null, 2));

  try {
    const member = await message.guild.members.fetch(userId);
    const baseName = (member.user.globalName || member.user.username)
      .split(" 🔥")[0]
      .slice(0, 28);
    await member.setNickname(`${baseName} 🔥${data.streak}`);
  } catch {}

  console.log(`[RACHA] ${message.author.username} → ${data.streak}`);
});

// ================= INTERACCIONES =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  // ---- /racha ----
  if (interaction.commandName === "racha") {
    const user =
      interaction.options.getUser("usuario") || interaction.user;
    const data = rachas[user.id] || { streak: 0, lastDay: "—" };

    const streak = data.streak;
    const last = data.lastDay;

    let medal = "🟣";
    if (streak >= 7) medal = "🥉";
    if (streak >= 14) medal = "🥈";
    if (streak >= 30) medal = "🥇";
    if (streak >= 60) medal = "👑";

    const max = 30;
    const percent = Math.min(streak / max, 1);
    const filled = Math.round(percent * 10);
    const bar = "🟪".repeat(filled) + "⬛".repeat(10 - filled);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`${medal} Racha de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: "🔥 Días consecutivos",
          value: `**${streak} días**`,
          inline: true,
        },
        {
          name: "📅 Último registro",
          value: last,
          inline: true,
        },
        {
          name: "📊 Progreso (30 días)",
          value: `${bar} **${Math.round(percent * 100)}%**`,
        },
      )
      .setFooter({ text: "Sistema de rachas" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ---- /toprachas ----
  if (interaction.commandName === "toprachas") {
    const sorted = Object.entries(rachas)
      .sort((a, b) => b[1].streak - a[1].streak)
      .slice(0, 10);

    let desc = "";
    for (let i = 0; i < sorted.length; i++) {
      const user = await client.users.fetch(sorted[i][0]).catch(() => null);
      if (!user) continue;
      desc += `**${i + 1}.** ${user.username} — **${sorted[i][1].streak} días**\n`;
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle("🏆 Top de rachas")
          .setDescription(desc || "No hay datos")
          .setTimestamp(),
      ],
    });
  }

  // ---- /resetrachas ----
  if (interaction.commandName === "resetrachas") {
    const isStaff = interaction.member.roles.cache.some((r) =>
      STAFF_ROLES.includes(r.id),
    );
    if (!isStaff)
      return interaction.editReply("❌ No tienes permisos.");

    const target = interaction.options.getUser("usuario");

    if (target) {
      delete rachas[target.id];
      fs.writeFileSync(FILE, JSON.stringify(rachas, null, 2));
      return interaction.editReply(
        `✅ Racha de ${target.username} reiniciada.`,
      );
    } else {
      rachas = {};
      fs.writeFileSync(FILE, "{}");
      return interaction.editReply("✅ Todas las rachas reiniciadas.");
    }
  }
});

// ================= READY =================
client.once("ready", () => {
  console.log(`🟣 Conectado como ${client.user.tag}`);
  client.user.setActivity("rachas activas", {
    type: ActivityType.Watching,
  });
});

// ================= WEB 24/7 =================
const app = express();
app.get("/", (_, res) => res.send("Bot online 24/7"));
app.listen(process.env.PORT || 10000, () =>
  console.log("Web activo"),
);

// ================= LOGIN =================
client.login(TOKEN);


