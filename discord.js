const { Client, GatewayIntentBits } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const supabase = createClient(
  "https://lttoegjwxfsrbpuoisth.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0dG9lZ2p3eGZzcmJwdW9pc3RoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTc2MzcyOCwiZXhwIjoyMDkxMzM5NzI4fQ.YzCj_xfcFRX7eNIzLb7MvGv7c7vjG5kv2GTXp61-XVg"
);

const PREFIX = "!";
const OWNER_ID = "1400164749655674953";

let logs = [];
let ultimoErro = null;
const cooldown = new Map();

function addLog(msg) {
  logs.push(msg);
  if (logs.length > 20) logs.shift();
  console.log(msg);
}

process.on("unhandledRejection", err => {
  ultimoErro = err.message;
  addLog("[ERRO] " + err.message);
});

client.on("ready", () => {
  addLog("Bot online");
});

function normalizar(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similar(a, b) {
  a = normalizar(a);
  b = normalizar(b);

  if (a.includes(b) || b.includes(a)) return true;

  function levenshtein(s1, s2) {
    const dp = Array.from({ length: s1.length + 1 }, () =>
      Array(s2.length + 1).fill(0)
    );

    for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
    for (let j = 0; j <= s2.length; j++) dp[0][j] = j;

    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;

        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[s1.length][s2.length];
  }

  const dist = levenshtein(a, b);
  const limite = Math.floor(Math.max(a.length, b.length) * 0.2);

  return dist <= limite;
}

async function encontrarObra(nomeInput) {
  const { data } = await supabase.from("works").select("name");

  if (!data) return null;

  const nome = normalizar(nomeInput);

  for (const w of data) {
    const base = normalizar(w.name);

    if (base === nome) return w.name;
    if (similar(base, nome)) return w.name;
  }

  return null;
}

async function garantirObra(nomeInput) {
  const nome = normalizar(nomeInput);

  const existente = await encontrarObra(nome);
  if (existente) return existente;

  await supabase.from("works").insert([{ name: nome }]);
  addLog(`[CATALOGO] nova obra: ${nome}`);
  return nome;
}

async function getSeguidores(nome) {
  const { data } = await supabase
    .from("followers")
    .select("user_id")
    .eq("obra", nome);

  return data ? data.map(u => u.user_id) : [];
}

async function jaSegue(userId, nome) {
  const { data } = await supabase
    .from("followers")
    .select("id")
    .eq("user_id", userId)
    .eq("obra", nome)
    .maybeSingle();

  return !!data;
}

async function seguir(userId, nome) {
  if (await jaSegue(userId, nome)) return false;

  await supabase.from("followers").insert([{ user_id: userId, obra: nome }]);
  return true;
}

async function parar(userId, nome) {
  await supabase
    .from("followers")
    .delete()
    .eq("user_id", userId)
    .eq("obra", nome);
}

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const now = Date.now();
    if (cooldown.has(message.author.id)) {
      if (now - cooldown.get(message.author.id) < 2000) return;
    }
    cooldown.set(message.author.id, now);

    const args = message.content.slice(PREFIX.length).trim().split(" ");
    const cmd = (args.shift() || "").toLowerCase();
    const userId = message.author.id;
    const isOwner = userId === OWNER_ID;

    if (!cmd) {
      return message.reply("Comando não reconhecido ou não existe.");
    }

    if (cmd === "ajuda") {
      return message.reply(
`📌 COMANDOS

!seguir <obra>
!parar <obra>
!minhas
!limpar
!seguindo <obra>
!top

!status
!ping
!banco (admin)
!restart (admin)`
      );
    }

    if (message.content.toLowerCase() === "!e o que sobra pro beta?") {
      return message.reply("não sobra nada pro beta, brutal");
    }

    if (cmd === "banco") {
      if (!isOwner) return message.reply("Sem permissão.");

      const { data } = await supabase
        .from("followers")
        .select("user_id, obra");

      if (!data?.length) return message.reply("Banco vazio.");

      const map = {};

      data.forEach(r => {
        if (!map[r.user_id]) map[r.user_id] = [];
        map[r.user_id].push(r.obra);
      });

      let texto = "📂 Banco:\n\n";

      for (const [id, obras] of Object.entries(map)) {
        texto += `<@${id}> → ${obras.join(", ")}\n`;
      }

      return message.channel.send(texto.slice(0, 1900));
    }

    if (cmd === "status" || cmd === "ping") {
      if (!isOwner) return message.reply("Sem permissão.");

      const sent = await message.reply("...");
      const latency = sent.createdTimestamp - message.createdTimestamp;
      const apiPing = Math.round(client.ws.ping);

      return sent.edit(`Latência: ${latency}ms | API: ${apiPing}ms`);
    }

    if (cmd === "seguir") {
      const nomeOriginal = args.join(" ").trim();

      if (!nomeOriginal || nomeOriginal.length < 2 || nomeOriginal.length > 100) {
        return message.reply("Nome inválido.");
      }

      const nome = await garantirObra(nomeOriginal);

      const ok = await seguir(userId, nome);
      if (!ok) return message.reply("Você já segue essa obra.");

      addLog(`[SEGUIR] ${userId} -> ${nome}`);
      return message.reply(`Seguindo: ${nome}`);
    }

    if (cmd === "parar") {
      const nomeOriginal = args.join(" ").trim();

      if (!nomeOriginal || nomeOriginal.length < 2 || nomeOriginal.length > 100) {
        return message.reply("Nome inválido.");
      }

      const nome = await encontrarObra(nomeOriginal) || normalizar(nomeOriginal);

      await parar(userId, nome);
      addLog(`[PARAR] ${userId} -X-> ${nome}`);

      return message.reply(`Parou: ${nome}`);
    }

    return message.reply("Comando não reconhecido ou não existe.");

  } catch (err) {
    addLog("[CRASH] " + err.message);
    message.reply("Erro interno.");
  }
});

client.on("messageCreate", async (message) => {
  if (!message.webhookId) return;

  const content = message.content;

  const match = content.match(/Obra:\s*(.+)/i);
  if (!match) return;

  const nomeFinal = await garantirObra(match[1]);

  const seguidores = await getSeguidores(nomeFinal);

  await message.delete();

  if (seguidores.length > 0) {
    await message.channel.send({
      content: seguidores.map(id => `<@${id}>`).join(" ") + " 📢 Atualização",
      allowedMentions: { users: seguidores },
      embeds: [{ description: content }]
    });
  } else {
    await message.channel.send({
      content: "📢 Atualização",
      embeds: [{ description: content }]
    });
  }
});

client.login(process.env.TOKEN);