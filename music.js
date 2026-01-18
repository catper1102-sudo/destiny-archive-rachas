// ================= IMPORTS =================
import { DisTube } from "distube";
import { YtDlpPlugin } from "@distube/yt-dlp";
import { EmbedBuilder } from "discord.js";

// ================= DISTUBE CLIENT =================
let distubeClient;

export function initMusic(client) {
  distubeClient = new DisTube(client, {
    plugins: [new YtDlpPlugin()],
  });

  console.log("✅ distubeClient inicializado");

  distubeClient
    .on("playSong", (queue, song) => {
      queue.textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎶 Reproduciendo ahora")
            .setDescription(`**${song.name}**\n${song.url}`)
            .setColor("#1F1F1F"),
        ],
      });
    })
    .on("addSong", (queue, song) => {
      queue.textChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("➕ Canción añadida a la cola")
            .setDescription(`**${song.name}**\n${song.url}`)
            .setColor("#FFD700"),
        ],
      });
    })
    .on("error", (channel, e) => {
      console.error("❌ Error música:", e);
      if (channel)
        channel.send("❌ Ocurrió un error al reproducir la canción.");
    });
}

export async function handleMusicInteraction(interaction) {
  if (!distubeClient) {
    console.error("❌ distubeClient no inicializado");
    return interaction.reply({
      content: "❌ Música no disponible",
      ephemeral: true,
    });
  }

  const cmd = interaction.commandName;

  try {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel)
      return interaction.reply({
        content: "❌ Debes estar en un canal de voz.",
        ephemeral: true,
      });

    if (cmd === "play") {
      const query = interaction.options.getString("query");

      await interaction.deferReply();

      // ⚡ Timeout de 10s para evitar quedarse pensando
      await Promise.race([
        distubeClient.play(voiceChannel, query, {
          member: interaction.member,
          textChannel: interaction.channel,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject("⏱ Timeout buscando canción"), 10000),
        ),
      ]);

      return interaction.editReply(`🎵 Reproduciendo: **${query}**`);
    }

    if (cmd === "skip") {
      const queue = distubeClient.getQueue(interaction.guildId);
      if (!queue)
        return interaction.reply({
          content: "❌ No hay canciones en la cola.",
          ephemeral: true,
        });
      await queue.skip();
      return interaction.reply("⏭ Canción saltada.");
    }

    if (cmd === "stop") {
      const queue = distubeClient.getQueue(interaction.guildId);
      if (!queue)
        return interaction.reply({
          content: "❌ No hay canciones en la cola.",
          ephemeral: true,
        });
      await queue.stop();
      return interaction.reply("⏹ Música detenida y cola borrada.");
    }

    if (cmd === "queue") {
      const queue = distubeClient.getQueue(interaction.guildId);
      if (!queue)
        return interaction.reply({
          content: "❌ No hay canciones en la cola.",
          ephemeral: true,
        });

      const description = queue.songs
        .map((song, i) => `${i + 1}. **${song.name}**`)
        .join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🎵 Cola de canciones")
            .setDescription(description)
            .setColor("#1F1F1F"),
        ],
      });
    }
  } catch (e) {
    console.error("❌ Error música:", e);
    if (interaction.deferred || interaction.replied)
      return interaction.editReply(
        `❌ Ocurrió un error: ${e.toString().slice(0, 100)}`,
      );
    return interaction.reply({
      content: `❌ Ocurrió un error: ${e.toString().slice(0, 100)}`,
      ephemeral: true,
    });
  }
}
