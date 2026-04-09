const { Client, GatewayIntentBits } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔥 SUPABASE
const supabase = createClient(
  "https://lttoegjwxfsrbpuoisth.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dG9lZ2p3eGZzcmJwdW9pc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjM3MjgsImV4cCI6MjA5MTMzOTcyOH0.-FhWETCsx0DNx3Y_xOg-VOUP5fiCgldAF2K1KfGcOlA"
);

const PREFIX = "!";

console.log("Bot iniciando...");

process.on("unhandledRejection", err => {
  console.log("ERRO NÃO TRATADO:", err);
});

client.on("ready", () => {
  console.log("Bot online");
});

// 🔥 HELPERS SUPABASE
async function getSeguidores(nome) {
  const { data } = await supabase
    .from("followers")
    .select("user_id")
    .eq("obra", nome);

  return data ? data.map(u => u.user_id) : [];
}

async function seguir(userId, nome) {
  await supabase.from("followers").insert([
    { user_id: userId, obra: nome }
  ]);
}

async function parar(userId, nome) {
  await supabase
    .from("followers")
    .delete()
    .eq("user_id", userId)
    .eq("obra", nome);
}

// 🔥 BOT
client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();
  const userId = message.author.id;

  // 🔥 STATUS
  if (cmd === "status" || cmd === "ping") {

    const sent = await message.reply("Calculando...");

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    // total de registros (aproximação)
    const { count } = await supabase
      .from("followers")
      .select("*", { count: "exact", head: true });

    await sent.edit(
`📊 Status do Bot

⏱️ Latência: ${latency}ms
🌐 API Ping: ${apiPing}ms
⏳ Uptime: ${h}h ${m}m ${s}s
👥 Registros no banco: ${count || 0}`
    );

    return;
  }

  // 🔥 BANCO
  if (cmd === "banco") {

    const { data } = await supabase
      .from("followers")
      .select("user_id, obra");

    if (!data || data.length === 0) {
      return message.reply("Banco vazio.");
    }

    const map = {};

    for (const row of data) {
      if (!map[row.user_id]) map[row.user_id] = [];
      map[row.user_id].push(row.obra);
    }

    let linhas = [];

    for (const [userId, obras] of Object.entries(map)) {
      linhas.push(`<@${userId}> → ${obras.join(", ")}`);
    }

    const limite = 1900;
    let atual = "📂 Banco de Dados:\n\n";

    for (const linha of linhas) {
      if ((atual + linha + "\n").length > limite) {
        await message.channel.send(atual);
        atual = "";
      }
      atual += linha + "\n";
    }

    if (atual.length > 0) {
      await message.channel.send(atual);
    }

    return;
  }

  // 🔥 seguir / parar
  const nomeOriginal = args.join(" ").trim();
  if (!nomeOriginal) return message.reply("Informe o nome da obra.");

  const nome = nomeOriginal.toLowerCase();

  if (cmd === "seguir") {
    await seguir(userId, nome);
    return message.reply(`agora você segue: ${nomeOriginal}`);
  }

  if (cmd === "parar") {
    await parar(userId, nome);
    return message.reply(`Você parou de seguir: ${nomeOriginal}`);
  }
});


// 🔥 WEBHOOK
client.on("messageCreate", async (message) => {

  if (!message.webhookId) return;

  const content = message.content;

  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) return;

  const nomeOriginal = match[1].trim();
  const nome = nomeOriginal.toLowerCase();

  const seguidores = await getSeguidores(nome);

  await message.delete();

  const chunkSize = 100;

  if (seguidores.length > 0) {

    for (let i = 0; i < seguidores.length; i += chunkSize) {
      const grupo = seguidores.slice(i, i + chunkSize);

      await message.channel.send({
        content: `${grupo.map(id => `<@${id}>`).join(" ")} 📢 Atualização`,
        allowedMentions: {
          users: grupo
        },
        embeds: [{
          description: content,
          color: 0xff69b4
        }]
      });
    }

  } else {
    await message.channel.send({
      content: "📢 Atualização",
      embeds: [{
        description: content,
        color: 0xff69b4
      }]
    });
  }
});

client.login(process.env.TOKEN);