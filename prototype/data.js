/* AESTHEVA prototype — fictional sample data. All providers, people, registrations and figures are invented for demonstration. */
window.AE_DATA = (function(){
const AREAS = ['Kazhakkoottam','Kowdiar','Pattom','Vellayambalam'];
const CATEGORIES = [
  {id:'skin', name:'Skin & facials', art:2},
  {id:'medaes', name:'Medical aesthetics', art:0},
  {id:'hair', name:'Hair & scalp', art:3},
  {id:'ayur', name:'Ayurveda & massage', art:1},
  {id:'nails', name:'Nails, lashes & brows', art:4},
  {id:'body', name:'Physio & body', art:5},
  {id:'dental', name:'Smile & dental', art:6},
  {id:'groom', name:'Grooming & makeup', art:7}
];
const TYPES = ['Clinic','Salon & studio','Wellness centre','Independent practitioner'];

const providers = [
 {id:'p1', name:'Lumière Skin & Laser Clinic', type:'Clinic', area:'Kowdiar', address:'TC 9/1420, Kowdiar Gardens Road, Kowdiar, Thiruvananthapuram 695003', art:0,
  tagline:'Consultant-led dermatology and aesthetic skin care',
  about:'A calm, consultant-led skin clinic near Kowdiar Square. Every medical treatment starts with an in-person assessment by a registered dermatologist, who will discuss whether a treatment is appropriate for you, the alternatives, and realistic expectations. Non-medical facials are delivered by certified aesthetic therapists.',
  amenities:['Private consultation rooms','Female practitioners available','Parking','Card & UPI'],
  hours:'Mon–Sat · 10:00–19:00', medical:true, active:true,
  verification:[
    {label:'Clinical establishment registration checked', scope:'Kerala Clinical Establishments registration · outpatient dermatology', date:'Aug 2026'},
    {label:'Practitioner registrations checked', scope:'2 doctors · TCMC registration · Dermatology (DDVL / MD)', date:'Aug 2026'},
    {label:'Business identity checked', scope:'GST & trade licence', date:'Aug 2026'}]},
 {id:'p2', name:'Saanvi Ayur Wellness', type:'Wellness centre', area:'Vellayambalam', address:'Saanvi House, Sasthamangalam Road, Vellayambalam, Thiruvananthapuram 695010', art:1,
  tagline:'Traditional Kerala Ayurveda therapies in a heritage tharavad setting',
  about:'Classical Kerala therapies — abhyanga, shirodhara and kizhi — in a restored tharavad home. Therapies are wellness services; an optional consultation with our BAMS physician is available and recommended before any therapeutic programme.',
  amenities:['Heritage setting','Shower & changing rooms','Herbal tea lounge','UPI'],
  hours:'Daily · 08:00–20:00', medical:true, active:true,
  verification:[
    {label:'Practitioner registration checked', scope:'1 physician · TCMC (Indian Systems of Medicine) · BAMS', date:'Jul 2026'},
    {label:'Therapist certifications checked', scope:'2 therapists · Panchakarma therapy certificate', date:'Jul 2026'},
    {label:'Business identity checked', scope:'Trade licence', date:'Jul 2026'}]},
 {id:'p3', name:'Ivory Room Beauty Studio', type:'Salon & studio', area:'Pattom', address:'2nd Floor, Plamoodu Junction, Pattom, Thiruvananthapuram 695004', art:2,
  tagline:'Editorial hair, bridal makeup and facials',
  about:'A light-filled studio above Pattom junction for considered cuts, colour, bridal trials and skin-loving facials. Non-medical beauty services only.',
  amenities:['Bridal suite','Women-only floor','Complimentary coffee','Card & UPI'],
  hours:'Tue–Sun · 10:00–20:00', medical:false, active:true,
  verification:[
    {label:'Business identity checked', scope:'GST & trade licence', date:'Sep 2026'},
    {label:'Stylist certifications checked', scope:'3 professionals · hair & makeup diplomas', date:'Sep 2026'}]},
 {id:'p4', name:'Dr. Kavya Raghunath', type:'Independent practitioner', area:'Kazhakkoottam', address:'Consulting suite 4, Technopark Phase I Road, Kazhakkoottam, Thiruvananthapuram 695582', art:3,
  tagline:'Consultant dermatologist & trichologist',
  about:'Independent consultant specialising in hair and scalp conditions, consulting from a shared clinical suite near Technopark. Procedures such as PRP are only offered after a full assessment and are not suitable for everyone.',
  amenities:['Evening slots for Technopark staff','Online follow-ups','UPI'],
  hours:'Mon–Fri · 12:00–20:00 · Sat 10:00–14:00', medical:true, active:true,
  verification:[
    {label:'Practitioner registration checked', scope:'TCMC registration · Dermatology, Venereology & Leprosy (MD)', date:'Jun 2026'},
    {label:'Identity checked', scope:'Government ID (not displayed)', date:'Jun 2026'}]},
 {id:'p5', name:'Kaya Mudra Physio & Pilates', type:'Wellness centre', area:'Kazhakkoottam', address:'Near Infosys Gate, Kazhakkoottam Bypass, Thiruvananthapuram 695582', art:5,
  tagline:'Physiotherapy, reformer Pilates and recovery',
  about:'Evidence-led physiotherapy assessments and small-room reformer Pilates. Clinical assessments are delivered by registered physiotherapists; Pilates and sports massage are non-medical fitness services.',
  amenities:['Reformer studio','Showers','Parking','Card & UPI'],
  hours:'Mon–Sat · 07:00–21:00', medical:true, active:true,
  verification:[
    {label:'Practitioner registration checked', scope:'1 physiotherapist · Kerala State Physiotherapy Council', date:'Aug 2026'},
    {label:'Instructor certification checked', scope:'Comprehensive reformer Pilates certificate', date:'Aug 2026'}]},
 {id:'p6', name:'Thalam Nail & Brow Bar', type:'Salon & studio', area:'Kowdiar', address:'Ground Floor, Golf Links Road, Kowdiar, Thiruvananthapuram 695003', art:4,
  tagline:'Gel nails, lash lifts and brow artistry',
  about:'A small, meticulous studio for long-wear gel, hand-painted nail art, lash lifts and laminated brows. Single-use files and autoclaved tools.',
  amenities:['Hygiene-first tools','Women-only','UPI'],
  hours:'Daily · 11:00–20:00', medical:false, active:true,
  verification:[
    {label:'Business identity checked', scope:'Trade licence', date:'Sep 2026'},
    {label:'Technician certifications checked', scope:'2 technicians · nail & lash certificates', date:'Sep 2026'}]},
 {id:'p7', name:'Veda Smile Studio', type:'Clinic', area:'Vellayambalam', address:'Opp. Museum Road, Vellayambalam, Thiruvananthapuram 695010', art:6,
  tagline:'Aesthetic dentistry & smile consultations',
  about:'A boutique dental practice focusing on smile assessments, professional whitening and preventive care. Whitening is offered only after a dental examination confirms it is appropriate.',
  amenities:['Digital smile preview','Evening appointments','Card & UPI'],
  hours:'Mon–Sat · 10:00–20:00', medical:true, active:true,
  verification:[
    {label:'Practitioner registration checked', scope:'Kerala State Dental Council · BDS, MDS (Prosthodontics)', date:'Jul 2026'},
    {label:'Clinical establishment registration checked', scope:'Dental clinic registration', date:'Jul 2026'}]},
 {id:'p8', name:'Ember & Oud Grooming', type:'Salon & studio', area:'Pattom', address:'Kesavadasapuram–Pattom Road, Pattom, Thiruvananthapuram 695004', art:7,
  tagline:'Modern grooming lounge — cuts, beard and skin',
  about:'Precise cuts, beard sculpting and de-tan facials in an unhurried lounge. Non-medical grooming services.',
  amenities:['Walk-in friendly','Card & UPI'],
  hours:'Daily · 10:00–21:00', medical:false, active:true,
  verification:[{label:'Business identity checked', scope:'GST & trade licence', date:'Oct 2026'}]}
];

const staff = [
 {id:'s1', providerId:'p1', name:'Dr. Meera Nair', role:'Consultant Dermatologist', medical:true, quals:['MBBS — Govt. Medical College, Thiruvananthapuram','MD Dermatology, Venereology & Leprosy','Fellowship in Aesthetic Dermatology'], reg:'TCMC Reg. No. 48XXX (sample)', years:14, langs:['Malayalam','English','Hindi'], bio:'Focuses on acne, pigmentation and conservative aesthetic care. Prefers stepwise plans and will tell you when a treatment isn’t right for you.', avail:{days:[1,2,3,4,5,6], start:'10:00', end:'17:00'}},
 {id:'s2', providerId:'p1', name:'Dr. Arjun Menon', role:'Dermatologist', medical:true, quals:['MBBS','DDVL','Certificate in Laser Dermatology'], reg:'TCMC Reg. No. 61XXX (sample)', years:8, langs:['Malayalam','English','Tamil'], bio:'Leads the laser and hair-reduction service, including patch testing and skin-type assessment.', avail:{days:[1,2,3,4,5], start:'12:00', end:'19:00'}},
 {id:'s3', providerId:'p1', name:'Riya Thomas', role:'Aesthetic Therapist', medical:false, quals:['CIDESCO Diploma in Beauty Therapy','Advanced facial techniques certificate'], reg:'', years:6, langs:['Malayalam','English'], bio:'Delivers non-medical facials and skin-care routines under the clinic’s protocols.', avail:{days:[2,3,4,5,6,0], start:'10:00', end:'19:00'}},
 {id:'s4', providerId:'p2', name:'Dr. Lakshmi Varma', role:'Ayurveda Physician', medical:true, quals:['BAMS — Govt. Ayurveda College, Thiruvananthapuram','PG Diploma in Panchakarma'], reg:'TCMC (ISM) Reg. No. 12XXX (sample)', years:11, langs:['Malayalam','English'], bio:'Offers consultations before therapeutic programmes and advises on whether therapies are suitable alongside other care.', avail:{days:[1,2,3,4,5,6], start:'09:00', end:'15:00'}},
 {id:'s5', providerId:'p2', name:'Anil Kumar', role:'Senior Ayurveda Therapist', medical:false, quals:['Certificate in Panchakarma Therapy','Kalari marma training'], reg:'', years:15, langs:['Malayalam'], bio:'Specialist in abhyanga and kizhi with a calm, steady technique.', avail:{days:[0,1,2,3,4,5,6], start:'08:00', end:'18:00'}},
 {id:'s6', providerId:'p2', name:'Devika S', role:'Ayurveda Therapist', medical:false, quals:['Certificate in Panchakarma Therapy'], reg:'', years:5, langs:['Malayalam','English'], bio:'Female therapist for women-only therapy bookings.', avail:{days:[0,1,2,3,4,5,6], start:'10:00', end:'20:00'}},
 {id:'s7', providerId:'p3', name:'Neha Pillai', role:'Creative Director & Senior Stylist', medical:false, quals:['Diploma in Hairdressing','Advanced colour certification'], reg:'', years:12, langs:['Malayalam','English','Hindi'], bio:'Known for soft, lived-in colour and precision bobs.', avail:{days:[2,3,4,5,6,0], start:'10:00', end:'19:00'}},
 {id:'s8', providerId:'p3', name:'Sara Joseph', role:'Bridal Makeup Artist', medical:false, quals:['Professional Makeup Artistry Diploma'], reg:'', years:9, langs:['Malayalam','English'], bio:'Kerala Christian and Hindu bridal looks — natural, long-wearing, camera-ready.', avail:{days:[2,3,4,5,6,0], start:'10:00', end:'20:00'}},
 {id:'s9', providerId:'p3', name:'Fathima R', role:'Skin & Brow Specialist', medical:false, quals:['Diploma in Cosmetology (non-medical)'], reg:'', years:4, langs:['Malayalam','English','Arabic'], bio:'Facials, threading and brow shaping.', avail:{days:[2,3,4,5,6,0], start:'11:00', end:'20:00'}},
 {id:'s10', providerId:'p4', name:'Dr. Kavya Raghunath', role:'Consultant Dermatologist & Trichologist', medical:true, quals:['MBBS','MD Dermatology, Venereology & Leprosy','Fellowship in Trichology'], reg:'TCMC Reg. No. 55XXX (sample)', years:10, langs:['Malayalam','English','Kannada'], bio:'Hair and scalp specialist. Investigates causes first; procedures are offered only where appropriate.', avail:{days:[1,2,3,4,5,6], start:'12:00', end:'20:00'}},
 {id:'s11', providerId:'p5', name:'Dr. Joel Mathew', role:'Physiotherapist', medical:true, quals:['BPT','MPT (Musculoskeletal)','Certified Pilates for Rehab'], reg:'KSPC Reg. (sample)', years:9, langs:['Malayalam','English'], bio:'Back, neck and post-natal rehabilitation. Clear plans with home exercise.', avail:{days:[1,2,3,4,5,6], start:'07:00', end:'14:00'}},
 {id:'s12', providerId:'p5', name:'Ann Maria George', role:'Pilates Instructor', medical:false, quals:['Comprehensive Reformer Pilates Certification','Sports massage certificate'], reg:'', years:5, langs:['Malayalam','English'], bio:'Reformer sessions for all levels and post-desk recovery.', avail:{days:[1,2,3,4,5,6], start:'14:00', end:'21:00'}},
 {id:'s13', providerId:'p6', name:'Meenu K', role:'Lead Nail Artist', medical:false, quals:['International nail technician certificate'], reg:'', years:7, langs:['Malayalam','English'], bio:'Hand-painted art and structured gel.', avail:{days:[0,1,2,3,4,5,6], start:'11:00', end:'20:00'}},
 {id:'s14', providerId:'p6', name:'Ishita Rao', role:'Lash & Brow Artist', medical:false, quals:['Lash lift & brow lamination certificates'], reg:'', years:4, langs:['English','Hindi','Malayalam'], bio:'Soft, natural lifts and laminated brows.', avail:{days:[0,2,3,4,5,6], start:'11:00', end:'20:00'}},
 {id:'s15', providerId:'p7', name:'Dr. Hari Krishnan', role:'Prosthodontist', medical:true, quals:['BDS','MDS Prosthodontics','Certificate in Aesthetic Dentistry'], reg:'KSDC Reg. (sample)', years:13, langs:['Malayalam','English','Tamil'], bio:'Conservative, examination-first approach to smile aesthetics.', avail:{days:[1,2,3,4,5,6], start:'10:00', end:'20:00'}},
 {id:'s16', providerId:'p8', name:'Rahul Das', role:'Senior Barber', medical:false, quals:['Barbering certificate'], reg:'', years:8, langs:['Malayalam','English'], bio:'Fades, textured crops and beard sculpting.', avail:{days:[0,1,2,3,4,5,6], start:'10:00', end:'21:00'}},
 {id:'s17', providerId:'p8', name:'Faizal M', role:'Grooming Specialist', medical:false, quals:['Skin care for men certificate'], reg:'', years:5, langs:['Malayalam','Hindi'], bio:'De-tan facials and head massage.', avail:{days:[0,1,2,3,4,5,6], start:'10:00', end:'21:00'}}
];

// kind: 'consult' medical consultation, 'treatment' medical treatment needing assessment, 'beauty' non-medical
const services = [
 {id:'v1', providerId:'p1', name:'Dermatology consultation', cat:'skin', kind:'consult', dur:30, price:800, deposit:300, staff:['s1','s2'], desc:'Assessment of your skin concern with a consultant dermatologist. Includes a written plan; no treatment is assumed.'},
 {id:'v2', providerId:'p1', name:'Acne & scar assessment', cat:'skin', kind:'consult', dur:45, price:1200, deposit:400, staff:['s1'], desc:'Detailed assessment of active acne and scarring with options explained, including non-procedural care.'},
 {id:'v3', providerId:'p1', name:'Chemical peel (after assessment)', cat:'medaes', kind:'treatment', dur:45, price:3500, deposit:800, staff:['s1','s2'], desc:'Superficial peel for clients already assessed by a clinic doctor. Your practitioner confirms suitability on the day.'},
 {id:'v4', providerId:'p1', name:'Laser hair reduction — consult & patch test', cat:'medaes', kind:'consult', dur:30, price:1000, deposit:300, staff:['s2'], desc:'Skin-type assessment and patch test. Treatment sessions are only booked if appropriate.'},
 {id:'v5', providerId:'p1', name:'Hydrating deep-cleanse facial', cat:'skin', kind:'beauty', dur:60, price:4200, deposit:800, staff:['s3'], desc:'Non-medical facial: cleanse, gentle exfoliation, extraction and hydration.'},
 {id:'v6', providerId:'p1', name:'Anti-wrinkle injectables consultation', cat:'medaes', kind:'consult', dur:30, price:1500, deposit:500, staff:['s1'], desc:'Doctor-led discussion of options, risks and alternatives. Any treatment is decided after assessment, never at booking.'},
 {id:'v7', providerId:'p2', name:'Abhyanga full-body oil massage', cat:'ayur', kind:'beauty', dur:90, price:2800, deposit:500, staff:['s5','s6'], desc:'Traditional warm-oil massage followed by steam.'},
 {id:'v8', providerId:'p2', name:'Shirodhara', cat:'ayur', kind:'beauty', dur:60, price:2400, deposit:500, staff:['s5','s6'], desc:'A continuous stream of warm oil over the forehead. Wellness service.'},
 {id:'v9', providerId:'p2', name:'Elakizhi herbal pouch therapy', cat:'ayur', kind:'beauty', dur:75, price:3200, deposit:600, staff:['s5','s6'], desc:'Warm herbal pouches with medicated oil.'},
 {id:'v10', providerId:'p2', name:'Ayurveda physician consultation', cat:'ayur', kind:'consult', dur:30, price:600, deposit:200, staff:['s4'], desc:'Consultation with a BAMS physician before starting a therapy programme.'},
 {id:'v11', providerId:'p3', name:'Signature cut & blow-dry', cat:'hair', kind:'beauty', dur:60, price:1400, deposit:300, staff:['s7'], desc:'Consultation, wash, precision cut and finish.'},
 {id:'v12', providerId:'p3', name:'Keratin smoothing', cat:'hair', kind:'beauty', dur:180, price:7500, deposit:1500, staff:['s7'], desc:'Frizz-taming smoothing treatment; strand test on the day.'},
 {id:'v13', providerId:'p3', name:'Bridal makeup trial', cat:'groom', kind:'beauty', dur:120, price:6000, deposit:1500, staff:['s8'], desc:'Full trial of your wedding-day look with photos.'},
 {id:'v14', providerId:'p3', name:'Gold radiance facial', cat:'skin', kind:'beauty', dur:75, price:2200, deposit:400, staff:['s9'], desc:'Non-medical brightening facial.'},
 {id:'v15', providerId:'p3', name:'Threading & brow shaping', cat:'nails', kind:'beauty', dur:20, price:250, deposit:0, staff:['s9'], desc:'Brow, upper lip or full face threading.'},
 {id:'v16', providerId:'p4', name:'Hair loss consultation', cat:'hair', kind:'consult', dur:40, price:1000, deposit:400, staff:['s10'], desc:'History, scalp examination and trichoscopy. Tests may be advised.'},
 {id:'v17', providerId:'p4', name:'PRP scalp session (after assessment)', cat:'medaes', kind:'treatment', dur:60, price:6500, deposit:1500, staff:['s10'], desc:'Only for existing patients for whom PRP has been recommended after assessment.'},
 {id:'v18', providerId:'p4', name:'Skin follow-up consultation', cat:'skin', kind:'consult', dur:20, price:700, deposit:200, staff:['s10'], desc:'Review of an existing plan.'},
 {id:'v19', providerId:'p5', name:'Physiotherapy assessment', cat:'body', kind:'consult', dur:45, price:900, deposit:300, staff:['s11'], desc:'Clinical assessment and treatment plan by a registered physiotherapist.'},
 {id:'v20', providerId:'p5', name:'Post-natal core rehabilitation', cat:'body', kind:'treatment', dur:45, price:1200, deposit:300, staff:['s11'], desc:'For clients cleared at assessment. Structured core and pelvic-floor focused exercise.'},
 {id:'v21', providerId:'p5', name:'Private reformer Pilates', cat:'body', kind:'beauty', dur:55, price:1800, deposit:400, staff:['s12'], desc:'1:1 reformer session — a fitness service, not therapy.'},
 {id:'v22', providerId:'p5', name:'Sports & recovery massage', cat:'body', kind:'beauty', dur:60, price:1600, deposit:300, staff:['s12'], desc:'Deep-tissue recovery massage.'},
 {id:'v23', providerId:'p6', name:'Gel manicure', cat:'nails', kind:'beauty', dur:60, price:1100, deposit:200, staff:['s13'], desc:'Shape, cuticle care and long-wear gel.'},
 {id:'v24', providerId:'p6', name:'Gel pedicure', cat:'nails', kind:'beauty', dur:75, price:1400, deposit:300, staff:['s13'], desc:'Soak, exfoliation and gel finish.'},
 {id:'v25', providerId:'p6', name:'Lash lift & tint', cat:'nails', kind:'beauty', dur:60, price:2500, deposit:500, staff:['s14'], desc:'Patch test required 48 hours before first lash service.'},
 {id:'v26', providerId:'p6', name:'Brow lamination & shape', cat:'nails', kind:'beauty', dur:45, price:1800, deposit:400, staff:['s14'], desc:'Lamination, tint and tidy.'},
 {id:'v27', providerId:'p7', name:'Smile design consultation', cat:'dental', kind:'consult', dur:30, price:500, deposit:200, staff:['s15'], desc:'Examination, digital smile preview and options.'},
 {id:'v28', providerId:'p7', name:'Professional whitening (after exam)', cat:'dental', kind:'treatment', dur:60, price:8000, deposit:2000, staff:['s15'], desc:'In-clinic whitening for patients examined within the last 3 months.'},
 {id:'v29', providerId:'p7', name:'Scaling & polishing', cat:'dental', kind:'consult', dur:45, price:1500, deposit:300, staff:['s15'], desc:'Dental clean with a brief examination.'},
 {id:'v30', providerId:'p8', name:'Precision haircut', cat:'groom', kind:'beauty', dur:45, price:600, deposit:0, staff:['s16','s17'], desc:'Cut, wash and style.'},
 {id:'v31', providerId:'p8', name:'Beard sculpt & hot towel', cat:'groom', kind:'beauty', dur:30, price:400, deposit:0, staff:['s16'], desc:'Shape, line-up and hot towel.'},
 {id:'v32', providerId:'p8', name:'De-tan facial', cat:'skin', kind:'beauty', dur:45, price:1200, deposit:200, staff:['s17'], desc:'Non-medical cleansing facial.'}
];

const reviews = [
 {providerId:'p1', staffId:'s1', name:'Aparna S.', rating:5, date:'2026-10-11', service:'Acne & scar assessment', text:'Dr. Meera explained everything without any pressure to book treatments. Left with a simple routine and a follow-up date.'},
 {providerId:'p1', staffId:'s3', name:'Divya M.', rating:5, date:'2026-10-02', service:'Hydrating deep-cleanse facial', text:'Beautiful, quiet rooms. Riya was gentle and talked me through each step.'},
 {providerId:'p1', staffId:'s2', name:'Nikhil R.', rating:4, date:'2026-09-20', service:'Laser hair reduction — consult & patch test', text:'Thorough patch test and honest about how many sessions might be needed. Waited 10 minutes past my time.'},
 {providerId:'p1', staffId:'s1', name:'Sreelakshmi P.', rating:5, date:'2026-09-03', service:'Dermatology consultation', text:'Felt listened to. Clear written plan.'},
 {providerId:'p2', staffId:'s5', name:'Gayathri V.', rating:5, date:'2026-10-14', service:'Abhyanga full-body oil massage', text:'The tharavad setting is lovely. Came out completely relaxed.'},
 {providerId:'p2', staffId:'s6', name:'Mariam A.', rating:5, date:'2026-09-28', service:'Shirodhara', text:'Booked a female therapist easily. Very calm and professional.'},
 {providerId:'p2', staffId:'s4', name:'Rohan K.', rating:4, date:'2026-09-09', service:'Ayurveda physician consultation', text:'Useful consultation; the doctor asked about my other medicines before suggesting anything.'},
 {providerId:'p3', staffId:'s7', name:'Anjali N.', rating:5, date:'2026-10-18', service:'Signature cut & blow-dry', text:'Neha is a magician with a bob. Best cut I’ve had in Trivandrum.'},
 {providerId:'p3', staffId:'s8', name:'Teresa J.', rating:5, date:'2026-10-05', service:'Bridal makeup trial', text:'The trial made the wedding morning stress-free. Looked like me, only better.'},
 {providerId:'p3', staffId:'s9', name:'Hiba F.', rating:4, date:'2026-09-15', service:'Gold radiance facial', text:'Relaxing facial, a little rushed at the end.'},
 {providerId:'p4', staffId:'s10', name:'Vishnu P.', rating:5, date:'2026-10-09', service:'Hair loss consultation', text:'Ordered tests before suggesting anything. Appreciated the evening slot after work.'},
 {providerId:'p4', staffId:'s10', name:'Keerthana R.', rating:5, date:'2026-09-21', service:'Skin follow-up consultation', text:'Quick, clear and kind.'},
 {providerId:'p5', staffId:'s11', name:'Ashwin T.', rating:5, date:'2026-10-16', service:'Physiotherapy assessment', text:'Proper assessment and a home plan I can actually follow.'},
 {providerId:'p5', staffId:'s12', name:'Neethu L.', rating:5, date:'2026-10-01', service:'Private reformer Pilates', text:'Ann Maria is encouraging and precise. Great for desk-job posture.'},
 {providerId:'p6', staffId:'s13', name:'Riya D.', rating:5, date:'2026-10-19', service:'Gel manicure', text:'Lasted three weeks without chipping. Spotless studio.'},
 {providerId:'p6', staffId:'s14', name:'Sneha K.', rating:4, date:'2026-10-07', service:'Lash lift & tint', text:'Lovely result; remember the patch test 48 hours before.'},
 {providerId:'p7', staffId:'s15', name:'Arun G.', rating:5, date:'2026-10-12', service:'Smile design consultation', text:'Showed a digital preview and told me whitening wasn’t the right first step. Honest.'},
 {providerId:'p7', staffId:'s15', name:'Lekha S.', rating:4, date:'2026-09-17', service:'Scaling & polishing', text:'Gentle and on time.'},
 {providerId:'p8', staffId:'s16', name:'Abhijith M.', rating:5, date:'2026-10-20', service:'Precision haircut', text:'Clean fade, no wait.'},
 {providerId:'p8', staffId:'s17', name:'Sanjay V.', rating:4, date:'2026-10-03', service:'De-tan facial', text:'Good value for the price.'}
];

const CLIENT_NAMES = ['Aishwarya Menon','Parvathy Nair','Anagha S','Rahul Krishnan','Devika Pillai','Fathima Shirin','Merin Thomas','Gopika R','Lakshmi Priya','Aravind Suresh','Nimisha Joseph','Haritha V','Sandra Mathew','Athira Mohan','Keerthi Raj','Neha George','Arya Unnikrishnan','Reshma Basheer','Vineetha K','Shilpa Varghese','Meenakshi Iyer','Akhila Sasi','Swathi Prakash','Jincy Paul','Ritu Sharma','Asha Kurian','Nandana B','Ammu Varma'];

const applications = [
 {id:'A-2207', name:'Mizhi Eye & Skin Aesthetics', type:'Clinic', area:'Kowdiar', submitted:'2026-10-24', status:'pending', medical:true,
  contact:'Dr. Rekha Varghese · Medical Director', lead:{name:'Dr. Rekha Varghese', role:'Dermatologist', reg:'TCMC 7XXXX (sample)', scope:'Dermatology (MD)'},
  services:[{name:'Dermatology consultation', cat:'skin', kind:'consult', dur:30, price:700, deposit:300},{name:'Pigmentation assessment', cat:'skin', kind:'consult', dur:45, price:1100, deposit:400},{name:'Signature hydrating facial', cat:'skin', kind:'beauty', dur:60, price:3200, deposit:600}],
  docs:[{name:'Clinical establishment registration', file:'KCE_registration_mizhi.pdf', ok:false},{name:'Medical council registration — lead doctor', file:'TCMC_cert_rekha.pdf', ok:false},{name:'GST certificate', file:'GST_mizhi.pdf', ok:false},{name:'Professional indemnity cover', file:'indemnity_2026.pdf', ok:false}], notes:[]},
 {id:'A-2209', name:'Pournami Bridal Studio', type:'Salon & studio', area:'Kazhakkoottam', submitted:'2026-10-26', status:'pending', medical:false,
  contact:'Pournami Suresh · Owner', lead:{name:'Pournami Suresh', role:'Bridal Makeup Artist', reg:'', scope:'Makeup artistry diploma'},
  services:[{name:'Bridal makeup', cat:'groom', kind:'beauty', dur:150, price:15000, deposit:3000},{name:'Party makeup', cat:'groom', kind:'beauty', dur:60, price:3500, deposit:700},{name:'Saree draping', cat:'groom', kind:'beauty', dur:30, price:800, deposit:0}],
  docs:[{name:'Trade licence', file:'trade_licence_pournami.jpg', ok:false},{name:'Owner ID (masked)', file:'id_masked.pdf', ok:false},{name:'Certification — makeup artistry', file:'diploma.pdf', ok:false}], notes:[]},
 {id:'A-2198', name:'Dr. Sneha Iyer Cosmetology', type:'Independent practitioner', area:'Pattom', submitted:'2026-10-17', status:'info', medical:true,
  contact:'Dr. Sneha Iyer', lead:{name:'Dr. Sneha Iyer', role:'Cosmetologist', reg:'Pending', scope:'Requested: injectables consultations'},
  services:[{name:'Aesthetic consultation', cat:'medaes', kind:'consult', dur:30, price:1000, deposit:400}],
  docs:[{name:'Medical council registration', file:'—', ok:false},{name:'Cosmetology fellowship certificate', file:'fellowship.pdf', ok:false}], notes:[{date:'2026-10-19', text:'Requested TCMC registration certificate; fellowship alone does not cover medical scope.'}]},
 {id:'A-2181', name:'Ember & Oud Grooming', type:'Salon & studio', area:'Pattom', submitted:'2026-10-02', status:'approved', medical:false,
  contact:'Rahul Das · Owner', lead:{name:'Rahul Das', role:'Senior Barber', reg:'', scope:'Barbering certificate'}, services:[],
  docs:[{name:'GST certificate', file:'gst.pdf', ok:true},{name:'Trade licence', file:'licence.pdf', ok:true}], notes:[{date:'2026-10-04', text:'Approved · scope: business identity.'}]}
];

const tickets = [
 {id:'T-1043', type:'refund', status:'open', created:'2026-10-27', providerId:'p3', customer:'Merin Thomas', amount:1500, service:'Bridal makeup trial', reason:'Cancelled 10 hours before due to a family emergency. Requests deposit refund outside the 24-hour window.', notes:[]},
 {id:'T-1041', type:'complaint', status:'open', created:'2026-10-25', providerId:'p2', customer:'Rohan K.', amount:0, service:'Abhyanga full-body oil massage', reason:'Waited 40 minutes past appointment time without an update.', notes:[]},
 {id:'T-1039', type:'complaint', status:'escalated', created:'2026-10-21', providerId:'p1', customer:'Akhila Sasi', amount:0, service:'Chemical peel (after assessment)', reason:'Says she was not told a separate consultation was needed before the peel. Listing has since been updated with clearer wording.', notes:[{date:'2026-10-22', text:'Provider confirmed listing copy updated. Awaiting customer reply.'}]},
 {id:'T-1036', type:'refund', status:'resolved', created:'2026-10-15', providerId:'p6', customer:'Swathi Prakash', amount:500, service:'Lash lift & tint', reason:'Provider cancelled due to technician illness.', notes:[{date:'2026-10-15', text:'Auto-refunded: provider cancellation.'}]}
];

const cities = [
 {id:'tvm', name:'Thiruvananthapuram', phase:'Phase 1 · Trivandrum', status:'active', target:'Live since Aug 2026', providers:8, waitlist:42, demand:100, checks:{'Provider pipeline (25+)':true,'Verification partner':true,'Local ops lead':true,'Payments & settlement':true,'Launch marketing':true}},
 {id:'kochi', name:'Kochi', phase:'Phase 2 · Kerala', status:'planned', target:'Target Q2 2027', providers:0, waitlist:118, demand:86, checks:{'Provider pipeline (25+)':false,'Verification partner':true,'Local ops lead':false,'Payments & settlement':true,'Launch marketing':false}},
 {id:'kzk', name:'Kozhikode', phase:'Phase 2 · Kerala', status:'planned', target:'Target Q3 2027', providers:0, waitlist:54, demand:61, checks:{'Provider pipeline (25+)':false,'Verification partner':false,'Local ops lead':false,'Payments & settlement':true,'Launch marketing':false}},
 {id:'tcr', name:'Thrissur', phase:'Phase 2 · Kerala', status:'planned', target:'Target Q3 2027', providers:0, waitlist:37, demand:48, checks:{'Provider pipeline (25+)':false,'Verification partner':false,'Local ops lead':false,'Payments & settlement':true,'Launch marketing':false}},
 {id:'blr', name:'Bengaluru', phase:'Phase 3 · India', status:'planned', target:'Exploring 2028', providers:0, waitlist:212, demand:92, checks:{'Provider pipeline (25+)':false,'Verification partner':false,'Local ops lead':false,'Payments & settlement':true,'Launch marketing':false}},
 {id:'che', name:'Chennai', phase:'Phase 3 · India', status:'planned', target:'Exploring 2028', providers:0, waitlist:96, demand:70, checks:{'Provider pipeline (25+)':false,'Verification partner':false,'Local ops lead':false,'Payments & settlement':true,'Launch marketing':false}},
 {id:'mum', name:'Mumbai', phase:'Phase 3 · India', status:'planned', target:'Exploring 2028', providers:0, waitlist:140, demand:78, checks:{'Provider pipeline (25+)':false,'Verification partner':false,'Local ops lead':false,'Payments & settlement':true,'Launch marketing':false}}
];

return {AREAS, CATEGORIES, TYPES, providers, staff, services, reviews, CLIENT_NAMES, applications, tickets, cities};
})();
