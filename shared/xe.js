// Xe (tank) roster shared by server and client.
// Ratings are 1-10 and follow the balance rule congPha + doBen + coDong = 20.
// Shot fields:
//   delay, dmg, r (blast radius), look (visual style)
//   windMul                     - wind sensitivity. Every shot of a xe flies the SAME curve for the same
//                                 angle/power/wind (Gunbound rule, user-verified), so no speed/gravity tweaks.
//   split {n, spread, speedMul} - splits at the top of the arc
//   count + gap                 - several shots fired one after another
//   bounce n                    - bounces on terrain before exploding
//   drill px                    - tunnels through terrain
//   crawl px (+ seek)           - lands then crawls along the ground
//   straight + fixedSpeed/range - flies in a straight line, no gravity
//   pierce                      - flies the normal curve but passes through terrain and tanks
//   sky {look, count, gap}      - strike falls from the sky onto the landing point
//   under {wait}                - delayed burst from under the landing point
//   quake {dmg, r, range, every}- shockwave running along the ground both ways
//   clones [dx...]              - copies fired from the sky above the shooter
//   effects: zone, heal, cleanse, poison, blind, mark, push, pull, selfArmor, ignoreArmor
//   shieldGain n (+ allyArmor {r, v}) - refills the shooter's Giáp ảo; allies nearby get armour until their turn
// Xe field shield {max, regen}: Giáp ảo (Gunbound "Shield" mobiles). It soaks hits before HP and refills at the
// start of the xe's own turn; poison, burning ground and sudden-death drain go straight to HP.

// name: the nickname shown everywhere (user: "đặt tên vui", e.g. Tề Thiên → Hầu Ca). Each one borrows a name people
// already know: Tây Du Ký (Hầu Ca, Thỏ Muội, Long Vương, Sa Đệ, Bọ Cạp Tinh, Tượng Tinh), Dragon Ball (Quy Lão),
// Hồng Lâu Mộng (Phượng Tỷ), World Cup 2010 (Bạch Tuộc Paul), Vietnamese words (Cú Vọ, hùng ca), wuxia "-nhi"/"tiểu".
// title: the proper name, shown under it on the xe details
export const XE_LIST = [
  // Redesign v3 (2026-10-01, docs: https://claude.ai/artifact/LX3ih79iFsa1AH2zG98aD1): every xe owns ONE mechanic
  // family and all three shots are variations of it; no family is shared, so no xe's shot is another xe's SS.
  // Every xe also has one passive of its own kind (anger, aura, shield, revive, heavy, stealth, thorns, foresight,
  // execute, mobility).
  {
    // Huyền thoại: only from a random pick (like Gunbound's Dragon); stronger than a normal xe on purpose
    id: 'rong', name: 'Long Vương', title: 'Rồng Lửa', animal: 'Rồng', role: 'Huyền thoại · Thời gian bay', legendary: true,
    colors: ['#d8342a', '#f2b134'], hp: 1300, armor: 0.18, angle: [10, 55], windMul: 1.0,
    rating: { congPha: 9, doBen: 7, coDong: 4 }, move: 130,
    passive: 'fury', passiveName: 'Long Nộ', passiveDesc: 'Mỗi lần mất máu, đòn kế tiếp coi như đã bay thêm 0.5 giây: lửa lớn sẵn.',
    desc: 'Bay càng lâu, lửa càng to. Chỉ Rồng có đòn mạnh lên theo thời gian bay.',
    shots: {
      s1: { name: 'Hỏa Cầu', desc: 'Đốm lửa lớn dần khi bay; bay trên 2 giây thì nổ to và cháy đất.', delay: 780, dmg: 300, r: 46, look: 'fire',
        grow: { t0: 50, t1: 120, dmg: [195, 345], r: [30, 48] }, zone: { r: 45, dmg: 40, turns: 2 } },
      s2: { name: 'Mưa Lửa', desc: 'Nửa sau đường bay nhỏ giọt lửa xuống đất; bay càng lâu càng nhiều giọt.', delay: 850, dmg: 120, r: 30, look: 'fire',
        drops: { every: 14, max: 6, dmg: 70, r: 18, zone: { r: 20, dmg: 22, turns: 2 } } },
      ss: { name: 'Thiên Long', desc: 'Bay trên 2 giây thì quả cầu hoá rồng; chạm đất rồng khè lửa quét hai bên.', delay: 1150, dmg: 520, r: 78, look: 'fire',
        transform: { at: 120, full: { dmg: 600, r: 80, zone: { r: 110, dmg: 50, turns: 3 } }, short: { dmg: 370, r: 52 } } },
    },
  },
  {
    id: 'kylan', name: 'Lân Nhi', title: 'Kỳ Lân', animal: 'Kỳ Lân', role: 'Hỗ trợ · Tia thẳng',
    colors: ['#f4f1ff', '#b98cff'], hp: 1000, armor: 0.10, angle: [15, 55], windMul: 0.8,
    rating: { congPha: 5, doBen: 6, coDong: 9 },
    passive: 'aura', passiveName: 'Thánh Thể', passiveDesc: 'Đầu mỗi lượt của Kỳ Lân, đồng đội đứng trong 120px hồi 30 máu.',
    desc: 'Tia sáng từ sừng: đánh địch, chữa bạn. Đạn Kỳ Lân không bao giờ làm đau đồng đội.',
    shots: {
      s1: { name: 'Tia Sừng', desc: 'Viên dẫn bay theo cung; sừng bắn tia thẳng tới điểm rơi. Vật cản giữa đường ăn đòn; đồng đội trên tia được hồi.', delay: 700, dmg: 230, r: 30, look: 'crystal',
        tracer: true, beam: { heal: 60 } },
      s2: { name: 'Hào Quang', desc: 'Viên dẫn nở vòng sáng: đồng đội hồi máu và giải độc, giải mù; địch mất ít máu.', delay: 760, dmg: 90, r: 70, look: 'rainbow', heal: 180, cleanse: true },
      ss: { name: 'Thánh Quang', desc: 'Sừng phóng tia sáng lớn tới điểm rơi, xuyên mọi vật: địch trong vệt tia mất máu, đồng đội được hồi.', delay: 1080, dmg: 260, r: 40, look: 'light',
        tracer: true, beam: { wide: 42, heal: 150 } },
    },
  },
  {
    id: 'kimquy', name: 'Quy Lão', title: 'Kim Quy', animal: 'Rùa Vàng', role: 'Đỡ đòn · Xuyên xe',
    // tank with a regenerating energy shield, so its HP, armour and damage are lower than a plain tank's
    colors: ['#d9a520', '#5a8f3a'], hp: 1150, armor: 0.15, angle: [10, 55], windMul: 1.2,
    rating: { congPha: 5, doBen: 10, coDong: 5 },
    shield: { max: 300, regen: 60 },
    passive: 'shield', passiveName: 'Mai Thần (giáp ảo)', passiveDesc: 'Lớp giáp ảo 300 đỡ đòn trước khi mất máu, tự hồi +60 mỗi đầu lượt. Độc, đất cháy và Máu Cạn Dần xuyên qua giáp ảo.',
    desc: 'Rùa thần giữ Nỏ Thần của An Dương Vương: mũi tên xuyên thủng cả hàng xe.',
    shots: {
      s1: { name: 'Tên Đồng', desc: 'Mũi tên bay theo cung, xuyên qua mọi xe trên đường (xe sau chịu 70%), cắm đất thì nổ.', delay: 780, dmg: 200, r: 26, look: 'bolt', pierceXe: 0.7 },
      s2: { name: 'Rụt Mai', desc: 'Mũi tên xuyên xe; Kim Quy rụt vào mai: +120 giáp ảo, đồng đội đứng cạnh +20% giáp đến lượt của họ.', delay: 820, dmg: 130, r: 24, look: 'goldshield',
        pierceXe: 0.7, shieldGain: 120, allyArmor: { r: 90, v: 0.2 } },
      ss: { name: 'Nỏ Thần Vạn Tiễn', desc: '5 mũi tên vàng xoè hình quạt, mũi nào cũng xuyên qua xe.', delay: 1180, dmg: 110, r: 22, look: 'bolt', pierceXe: 0.7, fan: { n: 5, spread: 4 } },
    },
  },
  {
    id: 'phuong', name: 'Phượng Tỷ', title: 'Phượng Hoàng', animal: 'Phượng Hoàng', role: 'Bùng nổ · Tái sinh',
    colors: ['#ff7a1a', '#ffd23a'], hp: 850, armor: 0, angle: [20, 70], windMul: 1.3,
    rating: { congPha: 8, doBen: 5, coDong: 7 },
    passive: 'revive', passiveName: 'Tái Sinh', passiveDesc: 'Một lần mỗi trận, hồi sinh với 25% máu khi bị hạ.',
    desc: 'Nổ rồi còn sống lại: chim lửa bật lên từ tro và nổ tiếp.',
    shots: {
      s1: { name: 'Lông Phượng Lửa', desc: 'Lông phượng rực lửa nổ, rồi một chú phượng non bật lên nhảy về phía trước và nổ lần hai.', delay: 720, dmg: 170, r: 30, look: 'feather',
        reborn: { hops: [{ dir: 1, dmg: 110, r: 26, v: 2.6 }] } },
      s2: { name: 'Phượng Non', desc: 'Nổ, rồi hai chú phượng non bật sang trước và sau, mỗi con nổ một lần.', delay: 800, dmg: 160, r: 30, look: 'ember',
        reborn: { hops: [{ dir: 1, dmg: 90, r: 24, v: 2.4 }, { dir: -1, dmg: 90, r: 24, v: 2.4 }] } },
      ss: { name: 'Niết Bàn', desc: 'Nổ lớn rồi tái sinh 3 lần liên tiếp, mỗi lần nhảy xa hơn và nổ to hơn.', delay: 1100, dmg: 300, r: 56, look: 'phoenix',
        reborn: { chain: true, hops: [{ dir: 1, dmg: 120, r: 34, v: 2.6 }, { dir: 1, dmg: 150, r: 40, v: 3.1 }, { dir: 1, dmg: 180, r: 46, v: 3.6 }] } },
    },
  },
  {
    id: 'voi', name: 'Tượng Tinh', title: 'Voi Chiến', animal: 'Voi', role: 'Phá địa hình · Đẩy văng',
    colors: ['#8a8f99', '#b87333'], hp: 1250, armor: 0.20, angle: [20, 70], windMul: 0.8,
    rating: { congPha: 7, doBen: 9, coDong: 4 }, move: 130,
    passive: 'heavy', passiveName: 'Thân Nặng', passiveDesc: 'Không bị đẩy, kéo hay hất văng bởi bất kỳ đòn nào.',
    desc: 'Hai nòng như Ice của Gunbound: tháp trên lưng phá đất, vòi phun nước hất văng.',
    shots: {
      s1: { name: 'Pháo Tháp', desc: 'Bắn từ tháp trên lưng (điểm bắn cao): đạn đá nặng, phá đất rộng, đẩy nhẹ.', delay: 820, dmg: 250, r: 40, look: 'rock', carveMul: 1.4, push: 40, muzzle: { dx: -16, dy: -4 } },
      s2: { name: 'Vòi Rồng', desc: 'Bắn từ vòi (điểm bắn thấp, dễ vướng vách): khối nước đẩy văng rất xa.', delay: 860, dmg: 150, r: 40, look: 'water', push: 130, muzzle: { dx: 12, dy: 11 } },
      ss: { name: 'Voi Dậm', desc: 'Sóng chấn động chạy dọc mặt đất hai bên, hất bật mọi xe trên đường.', delay: 1150, dmg: 250, r: 50, look: 'rock', quake: { dmg: 130, r: 26, range: 320, every: 45, push: 70 } },
    },
  },
  {
    id: 'bachtuoc', name: 'Bạch Tuộc Paul', title: 'Bạch Tuộc', animal: 'Bạch Tuộc', role: 'Khống chế · Mù và trói',
    colors: ['#8e44ad', '#5dd6ff'], hp: 1050, armor: 0.10, angle: [10, 50], windMul: 1.1,
    rating: { congPha: 6, doBen: 7, coDong: 7 },
    passive: 'stealth', passiveName: 'Ẩn Mực', passiveDesc: 'Dưới 30% máu, Bạch Tuộc ẩn trong mực: đối thủ chỉ thấy vệt mực mờ.',
    desc: 'Phun mực cho mù, xúc tu trói chân. Chỉ Bạch Tuộc khoá hành động của địch.',
    shots: {
      s1: { name: 'Mực Đen', desc: 'Xe trúng đòn bị mực che: lượt sau không thấy gió.', delay: 720, dmg: 200, r: 40, look: 'ink', blind: true },
      s2: { name: 'Xúc Tu Trói', desc: 'Xúc tu quấn xe trúng đòn: lượt sau không di chuyển được.', delay: 780, dmg: 180, r: 36, look: 'tentacle', root: true },
      ss: { name: 'Kraken', desc: 'Xúc tu khổng lồ trồi lên: mọi địch trong 140px vừa mù vừa bị trói.', delay: 1100, dmg: 280, r: 50, look: 'tentacle', aura: { r: 140, blind: true, root: true } },
    },
  },
  {
    id: 'bocap', name: 'Bọ Cạp Tinh', title: 'Bọ Cạp', animal: 'Bọ Cạp', role: 'Độc · Mai phục',
    colors: ['#1d2b26', '#39e07a'], hp: 1000, armor: 0.15, angle: [10, 50], windMul: 0.9,
    rating: { congPha: 7, doBen: 6, coDong: 7 },
    passive: 'thorns', passiveName: 'Gai Độc', passiveDesc: 'Kẻ bắn trúng Bọ Cạp từ gần (trong 300px) bị nhiễm độc 25 × 2 lượt.',
    desc: 'Thả bọ con mai phục, độc lây lan. Chỉ Bọ Cạp gây độc.',
    shots: {
      s1: { name: 'Nọc Độc', desc: 'Gây độc 3 lượt.', delay: 700, dmg: 170, r: 32, look: 'poison', poison: { dmg: 40, turns: 3 } },
      s2: { name: 'Ổ Bọ Con', desc: 'Bắn ra 3 bọ con xoè hình quạt, mỗi con rơi một chỗ và không nổ; chúng nằm chờ trên mặt đất trọn một lượt (địch thấy được và có thể né); sau đó bò dọc mặt đất tới địch gần nhất trong 250px và chích độc. Không bò qua vách cao hay vực.', delay: 760, dmg: 0, r: 0, look: 'poison', fan: { n: 3, spread: 3.5 },
        minions: { n: 1, spread: 0, range: 250, dmg: 70, poison: { dmg: 30, turns: 2 }, life: 3 } },
      ss: { name: 'Bọ Cạp Tử Thần', desc: 'Bọ cạp tử thần nhỏ dãi độc lao tới: xuyên giáp; độc cực mạnh và lây sang địch đứng cạnh mỗi đầu lượt.', delay: 1100, dmg: 320, r: 45, look: 'sting', ignoreArmor: true,
        poison: { dmg: 80, turns: 3, spread: 80 } },
    },
  },
  {
    id: 'cu', name: 'Cú Vọ', title: 'Cú Đêm', animal: 'Cú Mèo', role: 'Bắn tỉa · Đánh dấu',
    colors: ['#7a5230', '#ffe14a'], hp: 800, armor: 0, angle: [10, 89], windMul: 0.7,
    rating: { congPha: 6, doBen: 4, coDong: 10 },
    passive: 'foresight', passiveName: 'Mắt Cú', passiveDesc: 'Khi ngắm, Cú thấy trước đoạn đầu đường bay của phát bắn.',
    desc: 'Đánh dấu rồi săn đúng con mồi. Góc 10–89°, ít gió nhất game.',
    shots: {
      s1: { name: 'Lông Vũ', desc: 'Phi tiêu ít bị gió nhất game: đòn chính xác để đo tầm.', delay: 680, dmg: 230, r: 28, look: 'dart', windMul: 0.7 },
      s2: { name: 'Mắt Đêm', desc: 'Đánh dấu: mọi đòn của cả đội vào mục tiêu +30% trong 1 vòng (ai cũng kịp bắn một lượt).', delay: 760, dmg: 140, r: 30, look: 'eye', mark: true },
      ss: { name: 'Cú Săn Mồi', desc: 'Cú lớn bay theo cung; có địch bị đánh dấu trong 350px thì bẻ hướng lao thẳng vào nó.', delay: 1060, dmg: 380, r: 48, look: 'eye', homing: { range: 350 } },
    },
  },
  {
    id: 'camap', name: 'Sa Đệ', title: 'Cá Mập Cát', animal: 'Cá Mập', role: 'Đào hầm · Dưới lòng đất',
    colors: ['#5b6f82', '#ff8a3a'], hp: 1050, armor: 0.10, angle: [10, 50], windMul: 1.0,
    rating: { congPha: 8, doBen: 6, coDong: 6 },
    passive: 'execute', passiveName: 'Đánh Hơi Máu', passiveDesc: 'Đòn của Cá Mập gây thêm 20% sát thương lên xe dưới 50% máu.',
    desc: 'Bơi dưới cát, trồi lên cắn. Chỉ Cá Mập đi xuyên lòng đất (như Nak của Gunbound).',
    shots: {
      s1: { name: 'Răng Khoan', desc: 'Khoan xuyên địa hình một đoạn dài rồi nổ.', delay: 760, dmg: 240, r: 36, look: 'drill', drill: 160 },
      s2: { name: 'Lặn Cát', desc: 'Chạm đất thì lặn, bơi ngầm rồi trồi lên nổ. Vào đất dốc thì trồi gần, vào thoải thì bơi xa.', delay: 820, dmg: 260, r: 36, look: 'fin', tunnel: { max: 420 } },
      ss: { name: 'Cá Mập Đánh Hơi', desc: 'Bay xuyên mọi địa hình, chỉ dừng khi chạm xe: hàm khổng lồ ngoạm.', delay: 1150, dmg: 420, r: 64, look: 'jaw', ghost: true },
    },
  },
  {
    // Huyền thoại (like Gunbound's Knight): random-only, stronger on purpose
    id: 'tethien', name: 'Hầu Ca', title: 'Tề Thiên', animal: 'Khỉ', role: 'Huyền thoại · Gió và biến hoá', legendary: true,
    colors: ['#b5651d', '#ffd700'], hp: 1050, armor: 0.08, angle: [10, 80], windMul: 1.4,
    rating: { congPha: 7, doBen: 5, coDong: 8 }, move: 300,
    passive: 'mobility', passiveName: 'Cân Đẩu', passiveDesc: 'Lực đi gấp đôi và leo được dốc cao hơn mọi xe khác.',
    desc: 'Mỹ Hầu Vương: chuối boomerang theo gió, Gậy Như Ý mọc thành cột, cân đẩu vân bay tới.',
    shots: {
      s1: { name: 'Chuối Boomerang', desc: 'Chuối cong ngược, rất nhạy gió; đổi chiều giữa không trung thì +20% sát thương và thưởng "Boomerang".', delay: 680, dmg: 265, r: 34, look: 'banana', curve: 0.07, windMul: 1.15, boomerang: 1.25 },
      s2: { name: 'Gậy Như Ý', desc: 'Gậy cắm xuống điểm rơi rồi mọc cao thành cột chắn đạn trong 2 vòng.', delay: 760, dmg: 230, r: 30, look: 'staff', pillar: { h: 170, w: 14, turns: 2 } },
      ss: { name: 'Cân Đẩu Vân', desc: 'Cưỡi mây bay theo đường đạn, đáp xuống nổ lớn và đứng luôn tại đó.', delay: 1100, dmg: 415, r: 58, look: 'cloud', rideTo: true },
    },
  },
  {
    id: 'gau', name: 'Hùng Ca', title: 'Gấu Bắc Cực', animal: 'Gấu Trắng', role: 'Đỡ đòn · Đóng băng',
    colors: ['#f4fbff', '#6fc8ff'], hp: 1300, armor: 0.18, angle: [15, 60], windMul: 0.9,
    rating: { congPha: 6, doBen: 9, coDong: 5 }, move: 110,
    passive: 'thickfur', passiveName: 'Lông Dày', passiveDesc: 'Không đòn nào gây quá 320 máu cho Gấu trong một lần trúng.',
    desc: 'Gấu tròn quàng khăn len cõng pháo băng tủ lạnh. Chỉ Gấu làm chậm lượt của địch.',
    shots: {
      s1: { name: 'Cầu Tuyết', desc: 'Xe trúng đòn bị lạnh cóng: lượt kế tiếp của nó đến chậm hơn (delay +150).', delay: 760, dmg: 210, r: 34, look: 'snow', chill: 150 },
      s2: { name: 'Băng Phong', desc: 'Đóng băng xe trúng đòn: nó mất trọn lượt kế tiếp, nhưng trong lúc bị đóng băng chỉ nhận 50% sát thương.', delay: 840, dmg: 150, r: 30, look: 'ice', freeze: true },
      ss: { name: 'Kỷ Băng Hà', desc: 'Bão tuyết: mọi địch trong 300px bị chậm lượt (delay +250) và SS của chúng khoá thêm 1 lượt.', delay: 1120, dmg: 260, r: 60, look: 'blizzard', blizzard: { r: 300, chill: 250 } },
    },
  },
  {
    id: 'canhcut', name: 'Tiểu Cụt', title: 'Chim Cánh Cụt', animal: 'Cánh Cụt', role: 'Lừa đảo · Nảy dội',
    colors: ['#1c2330', '#ff9a2a'], hp: 1000, armor: 0.10, angle: [10, 60], windMul: 1.0,
    rating: { congPha: 7, doBen: 6, coDong: 7 },
    passive: 'swim', passiveName: 'Bơi Lội', passiveDesc: 'Lần đầu rơi xuống nước trong trận, Cánh Cụt bơi lên bờ gần nhất thay vì chết.',
    desc: 'Cánh cụt kính râm lướt ván băng: đạn nảy dội như bi-a, càng nảy càng đau.',
    shots: {
      s1: { name: 'Cá Đông Lạnh', desc: 'Cá cứng như gậy nảy dội khỏi đất tới 3 lần; mỗi lần nảy +25% sát thương.', delay: 720, dmg: 180, r: 30, look: 'fish', ricochet: { max: 3, grow: 0.25, keep: 0.72 } },
      s2: { name: 'Trượt Bụng', desc: 'Chạm đất thì trượt bụng dọc mặt đất, dội ngược khi đụng vách (+20% mỗi lần dội), nổ khi đâm vào xe.', delay: 800, dmg: 220, r: 34, look: 'slide', slide: { max: 480, grow: 0.2 } },
      ss: { name: 'Bi-a Băng', desc: 'Quả bi băng khổng lồ nảy dội tới 6 lần; mỗi lần nảy +30% sát thương.', delay: 1120, dmg: 240, r: 50, look: 'iceball', ricochet: { max: 6, grow: 0.3, keep: 0.8 } },
    },
  },
  {
    // Huyền thoại: the Jade Moon Rabbit, random-only, stronger on purpose
    id: 'tho', name: 'Thỏ Muội', title: 'Thỏ Ngọc', animal: 'Thỏ Ngọc', role: 'Huyền thoại · Trọng lực', legendary: true,
    colors: ['#ffffff', '#ffd23a'], hp: 1100, armor: 0.12, angle: [10, 75], windMul: 0.8, gravity: 0.62,
    rating: { congPha: 8, doBen: 6, coDong: 8 },
    passive: 'luck', passiveName: 'Chân Thỏ May Mắn', passiveDesc: '20% né hẳn một đòn trúng (không mất máu).',
    desc: 'Thỏ Ngọc cung trăng cầm chày cối ngọc. Đạn bay nhẹ như trên mặt trăng; chỉ Thỏ Ngọc đổi được trọng lực.',
    shots: {
      s1: { name: 'Bánh Mochi', desc: 'Bánh dẻo dính vào xe trúng đòn: phát bắn kế tiếp của nó nặng trĩu (trọng lực ×1.35) nên hụt tầm.', delay: 700, dmg: 220, r: 32, look: 'mochi', heavy: 1.35 },
      s2: { name: 'Vầng Trăng Khuyết', desc: 'Tạo vùng trăng bán kính 130px trong 1 vòng: mọi đạn bay qua vùng này nhẹ bẫng (trọng lực ×0.4).', delay: 780, dmg: 170, r: 32, look: 'pestle', moonZone: { r: 130, turns: 1 } },
      ss: { name: 'Đêm Trăng Rằm', desc: 'Nổ lớn, rồi cả trận vào đêm trăng rằm 1 vòng: đạn của địch nặng ×1.3 (hụt tầm), đạn của đội bạn nhẹ ×0.85.', delay: 1120, dmg: 360, r: 58, look: 'moon', moonNight: { foe: 1.3, ally: 0.85, turns: 1 } },
    },
  },
];

export const PICKABLE = () => XE_LIST.filter(x => !x.legendary);
export const LEGENDARY = () => XE_LIST.filter(x => x.legendary);
// chance that a "?" pick rolls a legendary xe (the whole-room random mode uses LEGEND_CHANCE_ROOM per player)
export const LEGEND_CHANCE = 0.3, LEGEND_CHANCE_ROOM = 0.2;

export const XE = Object.fromEntries(XE_LIST.map(x => [x.id, x]));
export const moveBudget = xe => xe.move ?? xe.rating.coDong * 24;
export const SHOT_KEYS = ['s1', 's2', 'ss'];
// SS follows Gunbound: ready from the start; after firing it, it is locked for your next SS_COOLDOWN turns.
// (Replaced our own "rage bar + 2 SS per match" on 2026-09-30.) Some sudden-death types change this.
export const SS_COOLDOWN = 4;

// Đột tử (Gunbound "Sudden Death"): starts after the chosen turn; items are locked from then on.
export const SUDDEN_TYPES = {
  double: { name: 'Bắn Đôi', desc: 'mọi phát bắn tự bắn hai lần, khoá SS' },
  bigbomb: { name: 'Bom To', desc: 'đạn nổ to hơn và mạnh hơn, khoá SS' },
  ss: { name: 'SS Mỗi Lượt', desc: 'được dùng SS ở mọi lượt' },
  drain: { name: 'Máu Cạn Dần', desc: 'mỗi vòng mọi xe mất máu, vòng sau mất nhiều hơn' },
};
export const DRAIN_STEP = 20; // Máu Cạn Dần: round k after sudden death costs k × 20 HP
export const SCORE_RESPAWN_TURNS = 4; // Score: the dead come back after this many turns

// Items (Vật phẩm): bought with in-match gold, one per turn, before firing.
export const START_GOLD = 400;
export const ITEMS = {
  dual: { key: '4', name: 'Bắn Đôi', icon: '×2', cost: 350, delay: 250, desc: 'Phát bắn lượt này bắn 2 lần.' },
  tele: { key: '5', name: 'Dịch Chuyển', icon: '⇄', cost: 300, delay: 150, desc: 'Đạn không nổ: bạn dịch chuyển tới điểm rơi.' },
  heal: { key: '6', name: 'Hồi Máu', icon: '✚', cost: 250, delay: 100, desc: 'Hồi 300 máu ngay lập tức.' },
  power: { key: '7', name: 'Đạn Mạnh', icon: '⚡', cost: 300, delay: 150, desc: 'Phát bắn lượt này +30% sát thương.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
// Teleport replaces the shot with a plain orb that moves you instead of exploding.
export const TELE_SHOT = { name: 'Dịch Chuyển', desc: '', delay: 0, dmg: 0, r: 0, look: 'crystal', teleport: true };
