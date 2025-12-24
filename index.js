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

const COLOR = 0x8b5cf6;

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
const hoy = () => new Date().toISOString().slice(0, 10);
const ayer = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

// ================= SLASH =================
const commands = [
  new SlashCommandBuilder()
    .setName("racha")
    .setDescription("Ver la racha de un usuario")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuario a consultar")
    ),

  new SlashCommandBuilder()
    .setName("toprachas")
    .setDescription("Ver el top de rachas"),

  new SlashCommandBuilder()
    .setName("resetrachas")
    .setDescription("Reiniciar rachas (solo staff)")
    .addUserOption(o =>
      o.setName("usuario").setDescription("Usuario a reiniciar")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map(c => c.toJSON());

// ================= REGISTRO =================
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("✅ Comandos registrados");
})();

// ================= RACHAS AUTO =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  const id = message.author.id;
  const today = hoy();

  if (!rachas[id]) rachas[id] = { streak: 0, lastDay: null };
  if (rachas[id].lastDay === today) return;

  rachas[id].streak =
    rachas[id].lastDay === ayer()
      ? rachas[id].streak + 1
      : 1;

  rachas[id].lastDay = today;
  fs.writeFileSync(FILE, JSON.stringify(rachas, null, 2));

  try {
    const member = await message.guild.members.fetch(id);
    const base = (member.user.globalName || member.user.username)
      .split(" 🔥")[0]
      .slice(0, 28);
    await member.setNickname(`${base} 🔥${rachas[id].streak}`);
  } catch {}

  console.log(`[RACHA] ${message.author.username} → ${rachas[id].streak}`);
});

// ================= INTERACCIONES =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  // ---- /racha ----
  if (interaction.commandName === "racha") {
    const user =
      interaction.options.getUser("usuario") || interaction.user;
    const data = rachas[user.id] || { streak: 0, lastDay: "—" };

    let medal = "🟣";
    if (data.streak >= 7) medal = "🥉";
    if (data.streak >= 14) medal = "🥈";
    if (data.streak >= 30) medal = "🥇";
    if (data.streak >= 60) medal = "👑";

    const max = 30;
    const filled = Math.min(Math.round((data.streak / max) * 10), 10);
    const bar = "🟪".repeat(filled) + "⬛".repeat(10 - filled);

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`${medal} Racha de ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "🔥 Días consecutivos", value: `**${data.streak}**`, inline: true },
        { name: "📅 Último registro", value: data.lastDay, inline: true },
        { name: "📊 Progreso (30 días)", value: bar }
      )
      .setFooter({ text: "Destiny Archive · Rachas" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ---- /toprachas ----
  if (interaction.commandName === "toprachas") {
    const sorted = Object.entries(rachas)
      .sort((a, b) => b[1].streak - a[1].streak)
      .slice(0, 10);

    if (!sorted.length) {
      return interaction.editReply("❌ No hay rachas registradas.");
    }

    const medals = ["🥇", "🥈", "🥉"];
    let desc = "";

    for (let i = 0; i < sorted.length; i++) {
      try {
        const user = await client.users.fetch(sorted[i][0]);
        const medal = medals[i] || `**${i + 1}.**`;
        desc += `${medal} ${user.username} — **${sorted[i][1].streak} días**\n`;
      } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle("🏆 Top de rachas")
      .setDescription(desc)
      .setFooter({ text: "Destiny Archive · Ranking" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ---- /resetrachas ----
  if (interaction.commandName === "resetrachas") {
    const isStaff = interaction.member.roles.cache.some(r =>
      STAFF_ROLES.includes(r.id)
    );
    if (!isStaff)
      return interaction.editReply("❌ No tienes permisos.");

    const target = interaction.options.getUser("usuario");

    if (target) {
      delete rachas[target.id];
      fs.writeFileSync(FILE, JSON.stringify(rachas, null, 2));

      try {
        const member = await interaction.guild.members.fetch(target.id);
        const base = (member.user.globalName || member.user.username)
          .split(" 🔥")[0]
          .slice(0, 28);
        await member.setNickname(base);
      } catch {}

      return interaction.editReply(
        `✅ Racha de ${target.username} reiniciada.`
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
