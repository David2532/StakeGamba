import{p as b,t as C,f as x,n as H,g as n,s as c,a as M,b as h,d as a}from"./iframe-BSFTehXB.js";import{c as B,s as R,i as U,d as P,a as A,S as O,p as t}from"./create-runtime-stories-DTjEnsM2.js";import{G as q,t as i}from"./Game-0tCe3pNC.js";import"./_commonjsHelpers-Cpj98o6Y.js";const r={reveal:{type:"reveal",board:[[{name:"L2"},{name:"L1"},{name:"L4"},{name:"H2"},{name:"L1"}],[{name:"H1"},{name:"L5"},{name:"L2"},{name:"H3"},{name:"L4"}],[{name:"L3"},{name:"L5"},{name:"L3"},{name:"H4"},{name:"L4"}],[{name:"H4"},{name:"H3"},{name:"L4"},{name:"L5"},{name:"L1"}],[{name:"H3"},{name:"L3"},{name:"L3"},{name:"H1"},{name:"H1"}]],paddingPositions:[216,205,195,16,65],gameType:"basegame",anticipation:[0,0,0,0,0]},setTotalWin:{type:"setTotalWin",amount:1e3},finalWin:{type:"finalWin",amount:0},freeSpinTrigger:{type:"freeSpinTrigger",totalFs:12,positions:[{reel:0,row:3},{reel:1,row:1},{reel:2,row:3},{reel:4,row:3}]},updateFreeSpin:{type:"updateFreeSpin",amount:1,total:12},winInfo:{type:"winInfo",totalWin:400,wins:[{symbol:"H3",kind:3,win:200,positions:[{reel:0,row:1},{reel:1,row:2},{reel:2,row:3}],meta:{lineIndex:4,multiplier:1,winWithoutMult:200,globalMult:1,lineMultiplier:1}},{symbol:"H3",kind:3,win:200,positions:[{reel:0,row:3},{reel:1,row:2},{reel:2,row:3}],meta:{lineIndex:13,multiplier:1,winWithoutMult:200,globalMult:1,lineMultiplier:1}}]},setWin:{type:"setWin",amount:400,winLevel:4},freeSpinEnd:{type:"freeSpinEnd",amount:400,winLevel:2}},o=(S,g=H)=>{A(S,{get skipLoadingScreen(){return g().skipLoadingScreen},action:async()=>{var p,d;await((d=(p=g()).action)==null?void 0:d.call(p,g().data))},children:(p,d)=>{O(p,{lang:"en",children:(m,L)=>{q(m,{get skipInitialLoadingScreen(){return g().skipLoadingScreen}})},$$slots:{default:!0}})},$$slots:{default:!0}})},D={title:"MODE_BASE/bookEvent"},{Story:s}=P();var j=C("<!> <!> <!> <!> <!> <!> <!> <!>",1);function u(S,g){b(g,!1),R(),U();var p=j(),d=x(p);const m=a(()=>i({skipLoadingScreen:!0,data:r.reveal,action:async e=>await t(e,{bookEvents:[]})}));s(d,{name:"reveal",get args(){return n(m)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var L=c(d,2);const w=a(()=>i({skipLoadingScreen:!0,data:r.setTotalWin,action:async e=>await t(e,{bookEvents:[]})}));s(L,{name:"setTotalWin",get args(){return n(w)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var y=c(L,2);const T=a(()=>i({skipLoadingScreen:!0,data:r.freeSpinTrigger,action:async e=>await t(e,{bookEvents:[]})}));s(y,{name:"freeSpinTrigger",get args(){return n(T)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var _=c(y,2);const W=a(()=>i({skipLoadingScreen:!0,data:r.updateFreeSpin,action:async e=>await t(e,{bookEvents:[]})}));s(_,{name:"updateFreeSpin",get args(){return n(W)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var v=c(_,2);const G=a(()=>i({skipLoadingScreen:!0,data:r.winInfo,action:async e=>await t(e,{bookEvents:[]})}));s(v,{name:"winInfo",get args(){return n(G)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var k=c(v,2);const E=a(()=>i({skipLoadingScreen:!0,data:r.setWin,action:async e=>await t(e,{bookEvents:[]})}));s(k,{name:"setWin",get args(){return n(E)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=c(k,2);const F=a(()=>i({skipLoadingScreen:!0,data:r.freeSpinEnd,action:async e=>await t(e,{bookEvents:[]})}));s(f,{name:"freeSpinEnd",get args(){return n(F)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}});var I=c(f,2);const $=a(()=>i({skipLoadingScreen:!0,data:r.finalWin,action:async e=>await t(e,{bookEvents:[]})}));s(I,{name:"finalWin",get args(){return n($)},template:o,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game skipInitialLoadingScreen={args.skipLoadingScreen} />
	</StoryLocale>
</StoryGameTemplate>`}}}),M(S,p),h()}u.__docgen={data:[],name:"ModeBaseBookEvent.stories.svelte"};const l=B(u,D),Q=["Reveal","SetTotalWin","FreeSpinTrigger","UpdateFreeSpin","WinInfo","SetWin","FreeSpinEnd","FinalWin"],V={...l.Reveal,tags:["svelte-csf-v5"]},X={...l.SetTotalWin,tags:["svelte-csf-v5"]},Y={...l.FreeSpinTrigger,tags:["svelte-csf-v5"]},Z={...l.UpdateFreeSpin,tags:["svelte-csf-v5"]},ee={...l.WinInfo,tags:["svelte-csf-v5"]},ne={...l.SetWin,tags:["svelte-csf-v5"]},ae={...l.FreeSpinEnd,tags:["svelte-csf-v5"]},te={...l.FinalWin,tags:["svelte-csf-v5"]};export{te as FinalWin,ae as FreeSpinEnd,Y as FreeSpinTrigger,V as Reveal,X as SetTotalWin,ne as SetWin,Z as UpdateFreeSpin,ee as WinInfo,Q as __namedExportsOrder,D as default};
