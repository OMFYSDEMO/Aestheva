// Service guides: one page per thing people search for ("teeth cleaning in Trivandrum"), written in their words.
// Each guide lists the live services that match its query, with real prices. A guide with nothing live is hidden
// from search engines until a business on Aestheva offers it, so no page is ever empty.

export interface Topic {
  slug: string;                 // URL: /trivandrum/<slug>
  name: string;                 // as people search for it: "Teeth cleaning"
  alt?: string;                 // the clinic's word, shown in brackets: "scaling"
  q: string;                    // search query used to find matching services (see searchTerms in views/pages.ts)
  cat: string;                  // category tile and colour
  medical?: boolean;            // done by a doctor or dentist: suitability is decided at assessment
  what: string;                 // a short, plain explanation
  expect: string[];             // what happens, in order
  faqs: [string, string][];
}

const ASSESS = "Your doctor or dentist first checks it is suitable for you, and will tell you if something else would suit you better.";

export const TOPICS: Topic[] = [
  {
    slug: "teeth-cleaning", name: "Teeth cleaning", alt: "scaling and polishing", q: "scaling", cat: "dental", medical: true,
    what: "A dental cleaning, usually called scaling, removes the hardened plaque (tartar) that brushing can't reach, from around and between the teeth and just under the gum line. It's often followed by polishing to remove surface stains.",
    expect: ["A registered dentist checks your teeth and gums first.", "Tartar is removed with an ultrasonic scaler and hand instruments.", "Teeth are polished, and you get advice on brushing and flossing.", "Most cleanings take 20 to 45 minutes."],
    faqs: [
      ["How often should I get my teeth cleaned?", "Many dentists suggest a check-up and cleaning about every six months, but your dentist will advise what suits your teeth and gums."],
      ["Does scaling hurt?", "Most people feel vibration and some pressure rather than pain. Teeth can feel a little sensitive for a day or two afterwards."],
      ["Does scaling weaken teeth?", "No. Scaling removes deposits from the tooth surface; it doesn't remove enamel."],
      ["How much does teeth cleaning cost in Trivandrum?", "Each clinic on Aestheva shows its full price before you book. The live prices are listed on this page."],
    ],
  },
  {
    slug: "teeth-whitening", name: "Teeth whitening", alt: "tooth brightening", q: "teeth whitening", cat: "dental", medical: true,
    what: "Professional whitening uses a peroxide gel, sometimes activated with a light or laser, to lift stains and make teeth look brighter. Done by a dentist, it's stronger and better controlled than shop-bought kits.",
    expect: ["A dentist checks your teeth and gums, as whitening isn't suitable for everyone.", "Your gums are protected and the whitening gel is applied in short rounds.", "You get aftercare advice, such as avoiding strongly coloured food and drink for a day or two.", "A session usually takes about an hour."],
    faqs: [
      ["Is teeth whitening safe?", "When it's done by a dentist after a check-up, whitening is a common treatment. Some people get temporary sensitivity. " + ASSESS],
      ["Does whitening work on crowns or fillings?", "No. Whitening only lightens natural teeth, which is one reason a dentist checks first."],
      ["How long does whitening last?", "It varies with diet and habits such as tea, coffee and smoking. Your dentist can advise on keeping it."],
      ["What's the difference between peroxide and laser whitening?", "Both use a whitening gel; laser or light-activated whitening uses a light to speed it up. Your dentist will suggest which suits you."],
    ],
  },
  {
    slug: "dental-filling", name: "Dental filling", alt: "tooth-coloured filling", q: "filling", cat: "dental", medical: true,
    what: "A filling repairs a tooth damaged by decay (a cavity) or a small break. Tooth-coloured composite fillings are matched to the shade of your tooth.",
    expect: ["A dentist examines the tooth and explains what's needed.", "The decay is removed and the tooth is cleaned.", "The filling is placed in layers, set with a light and shaped so your bite feels normal.", "Most fillings take 30 to 60 minutes."],
    faqs: [
      ["Do I need a filling if the tooth doesn't hurt?", "Cavities often don't hurt at first. Your dentist can tell you whether a filling is needed."],
      ["How long do composite fillings last?", "They commonly last many years, depending on the size of the filling and how it's cared for."],
      ["Can I eat after a filling?", "Composite fillings are set straight away; your dentist will tell you if you should wait, for example while numbness wears off."],
    ],
  },
  {
    slug: "laser-hair-removal", name: "Laser hair removal", alt: "laser hair reduction", q: "laser hair removal", cat: "medaes", medical: true,
    what: "Laser hair reduction uses light energy to target hair follicles and reduce regrowth. It's done over several sessions, because hair grows in cycles.",
    expect: ["A doctor checks your skin and hair type and whether laser is suitable for you.", "The area is cleaned and shaved, and you wear eye protection.", "The laser is passed over the area; many people feel a quick snapping or warm sensation.", "Sessions are usually spaced several weeks apart."],
    faqs: [
      ["How many sessions will I need?", "Most people need a course of several sessions. Your doctor will suggest a plan for your skin and hair."],
      ["Is laser hair removal permanent?", "It reduces hair growth; some people need occasional top-up sessions. Results vary from person to person."],
      ["Does it hurt?", "Most people describe a brief snapping or warm feeling. The doctor can adjust settings for comfort."],
      ["How much does laser hair removal cost in Trivandrum?", "Prices depend on the area treated. Each clinic on Aestheva shows its full price per session before you book; live prices are on this page."],
    ],
  },
  {
    slug: "chemical-peel", name: "Chemical peel", q: "chemical peel", cat: "skin", medical: true,
    what: "A chemical peel applies a mild acid solution to the skin to remove the outer layer of dead cells. Different peels are used for a dull complexion, acne marks or uneven skin tone.",
    expect: ["A doctor assesses your skin and chooses the type and strength of peel.", "Your skin is cleansed and the peel is applied for a few minutes, then neutralised.", "You may see light flaking for a few days afterwards.", "Daily sunscreen matters after a peel; you'll get aftercare advice."],
    faqs: [
      ["Is there downtime after a chemical peel?", "Light peels usually mean some redness or flaking for a few days. Your doctor will explain what to expect for your peel."],
      ["How many peels will I need?", "It depends on your skin and your goal. A course is often spaced a few weeks apart. " + ASSESS],
      ["Can I have a peel with active acne?", "Sometimes, depending on your skin. That's one reason a doctor assesses you first."],
    ],
  },
  {
    slug: "carbon-laser-peel", name: "Carbon laser peel", alt: "Hollywood peel", q: "carbon laser", cat: "skin", medical: true,
    what: "In a carbon laser peel, a thin layer of carbon lotion is applied and then lifted off the skin with a laser. It's used for oily skin, enlarged pores and a dull complexion, with little or no downtime.",
    expect: ["A doctor checks your skin first.", "Carbon lotion is applied and allowed to dry.", "A laser passes over the skin to remove the carbon layer.", "Most sessions take 15 to 30 minutes, and you can usually carry on with your day."],
    faqs: [
      ["Is a carbon peel the same as a Hollywood peel?", "Yes, it's often called a Hollywood or carbon laser peel."],
      ["Is there downtime?", "Usually very little; some people have mild redness for a few hours. " + ASSESS],
      ["Can it be done on lips, underarms or elbows?", "Some clinics offer it for these areas. Check the services listed on this page."],
    ],
  },
  {
    slug: "hair-fall-treatment", name: "Hair fall treatment", alt: "mesotherapy and GFC", q: "hair fall", cat: "hair", medical: true,
    what: "Hair fall has many causes, so treatment starts with finding out why. Clinic treatments for hair thinning include scalp mesotherapy and GFC (growth factor concentrate), given in a course of sessions.",
    expect: ["A doctor asks about your hair fall and examines your scalp, and may suggest tests.", "If a scalp treatment suits you, it's given as a series of sessions a few weeks apart.", "The doctor explains how many sessions to expect and how progress is reviewed."],
    faqs: [
      ["What is GFC treatment for hair?", "GFC uses growth factors prepared from your own blood, applied to the scalp. Your doctor will explain whether it suits you."],
      ["How many sessions will I need?", "It varies. A course of several sessions is common. Results vary from person to person. " + ASSESS],
      ["Can hair fall treatment help everyone?", "Not every cause of hair fall responds to scalp treatments, which is why the doctor looks for the cause first."],
    ],
  },
  {
    slug: "acne-scar-treatment", name: "Acne and acne scar treatment", q: "acne", cat: "skin", medical: true,
    what: "Clinic treatments for acne and the marks it leaves include medical peels and laser treatments, chosen by a doctor after looking at your skin.",
    expect: ["A doctor assesses your skin and the type of acne or scarring.", "You're offered a treatment plan, which may be a course of sessions.", "You get advice on skincare and sun protection between sessions."],
    faqs: [
      ["Which treatment is best for acne scars?", "It depends on the type of scar and your skin. " + ASSESS],
      ["How many sessions will I need?", "Most acne and scar treatments are done as a course. Your doctor will suggest a plan."],
    ],
  },
  {
    slug: "pigmentation-treatment", name: "Pigmentation treatment", q: "pigmentation", cat: "skin", medical: true,
    what: "Pigmentation means patches of skin that are darker than the rest, such as sun spots or melasma. Clinic treatments include medical peels, chosen by a doctor for your skin type.",
    expect: ["A doctor looks at the type and cause of the pigmentation.", "If a peel or other treatment suits you, it's usually given as a course.", "Daily sunscreen is an important part of the plan."],
    faqs: [
      ["Can pigmentation be removed completely?", "Results vary with the type of pigmentation and your skin. " + ASSESS],
      ["Why is sunscreen so important?", "Sun exposure can darken pigmentation again, so protection helps you keep your results."],
    ],
  },
  // Beauty, wellness and body art. These pages appear as soon as someone on Aestheva offers them.
  {
    slug: "facial", name: "Facial", q: "facial", cat: "skin",
    what: "A facial cleanses, exfoliates and hydrates the skin, usually finished with a mask and a relaxing massage. Different facials suit dry, oily or tired skin.",
    expect: ["A quick look at your skin and what you'd like.", "Cleansing, exfoliation and steam or extraction where suitable.", "A mask, massage and moisturiser to finish.", "Most facials take 45 to 90 minutes."],
    faqs: [
      ["How often should I get a facial?", "Many people book one every four to six weeks. Your beautician can suggest what suits your skin."],
      ["Which facial is right for me?", "Tell the beautician your skin type and any concerns, and they'll recommend one."],
    ],
  },
  {
    slug: "bridal-makeup", name: "Bridal makeup", q: "bridal makeup", cat: "groom",
    what: "Bridal makeup covers the look for your wedding and related functions, often with hairstyling and saree draping. Many artists offer a trial so you can agree the look beforehand.",
    expect: ["A chat about your outfit, jewellery and the look you want.", "A trial session, if offered, to agree the look.", "On the day: skin prep, makeup, hair and draping, timed around your function."],
    faqs: [
      ["How early should I book a bridal makeup artist?", "Popular artists book up early in the wedding season, so many brides book a few months ahead."],
      ["Is a trial worth it?", "A trial helps you and your artist agree the look before the day, and is especially useful for HD or airbrush makeup."],
    ],
  },
  {
    slug: "nail-art", name: "Nail art and extensions", q: "nail art", cat: "nails",
    what: "Nail art ranges from simple gel polish to hand-painted designs, chrome, French tips and gel or acrylic extensions.",
    expect: ["Choose your design, shape and length with the nail artist.", "Nails are prepared and shaped, and extensions are applied if you've chosen them.", "Gel polish and art are applied and cured under a lamp.", "Most appointments take 60 to 120 minutes."],
    faqs: [
      ["How long does gel nail art last?", "Gel polish commonly lasts two to three weeks, depending on your nails and daily routine."],
      ["Do extensions damage natural nails?", "Proper application and removal by a trained nail artist helps protect your natural nails."],
    ],
  },
  {
    slug: "tattoo", name: "Tattoo", q: "tattoo", cat: "tattoo",
    what: "A tattoo starts with a design consultation, then the artist tattoos it using sterile, single-use needles. Size, detail and placement decide how long it takes.",
    expect: ["A consultation to agree the design, size and placement.", "The skin is cleaned and the stencil is placed for you to check.", "The tattoo is done with sterile, single-use needles and fresh ink.", "You get aftercare instructions to help it heal well."],
    faqs: [
      ["How much does a tattoo cost?", "Custom work is usually priced by size and detail. Artists on Aestheva show a starting price and what changes it."],
      ["How do I know a studio is hygienic?", "Look for single-use needles opened in front of you, gloves, and a clean workspace. Ask the artist about their hygiene routine."],
    ],
  },
  {
    slug: "haircut", name: "Haircut and styling", q: "haircut", cat: "hair",
    what: "From a quick trim to a new cut, colour or blow-dry, a stylist shapes your hair to suit you.",
    expect: ["A chat about the look you want.", "Wash, cut and style.", "Advice on looking after your hair at home."],
    faqs: [["How often should I get a haircut?", "Many people trim every six to eight weeks to keep a style in shape."]],
  },
  {
    slug: "threading-waxing", name: "Threading and waxing", q: "threading", cat: "nails",
    what: "Threading shapes eyebrows and removes facial hair with a twisted cotton thread; waxing removes hair from larger areas such as arms and legs.",
    expect: ["Tell the beautician the shape or areas you'd like.", "Threading or waxing, with soothing lotion afterwards."],
    faqs: [["How long does waxing last?", "Usually around three to five weeks, depending on how quickly your hair grows."]],
  },
  {
    slug: "ayurvedic-massage", name: "Ayurvedic massage", alt: "abhyanga and shirodhara", q: "massage", cat: "ayur",
    what: "Kerala's traditional therapies include abhyanga, a full-body massage with warm herbal oils, and shirodhara, where warm oil is poured gently over the forehead.",
    expect: ["A short consultation about your health and preferences.", "The therapy with warm herbal oils, usually 45 to 90 minutes.", "Time to rest, and often a warm shower, afterwards."],
    faqs: [
      ["What is the difference between abhyanga and shirodhara?", "Abhyanga is a full-body oil massage; shirodhara is a steady stream of warm oil over the forehead. They're often combined."],
      ["Should I tell the therapist about health conditions?", "Yes. Mention any health conditions or pregnancy before your session."],
    ],
  },
];

export const topicBySlug = (slug: string) => TOPICS.find((t) => t.slug === slug);
