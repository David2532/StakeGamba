import{p as P,t as z,f as q,n as A,g as a,d as n,s as m,a as D,b as N}from"./iframe-D8zJoRmp.js";import{c as j,s as J,i as K,d as Q,a as V,S as X,l as t}from"./create-runtime-stories-Bv3iEogr.js";import{G as Y,t as r}from"./Game-C9SmUSi3.js";import"./_commonjsHelpers-Cpj98o6Y.js";const o={reveal:{type:"reveal",board:[[{name:"L1"},{name:"H1"},{name:"L1"},{name:"L2"},{name:"L2"},{name:"L3"},{name:"L2"},{name:"L3"},{name:"H3"}],[{name:"L2"},{name:"L2"},{name:"L3"},{name:"L2"},{name:"L2"},{name:"L3"},{name:"L2"},{name:"L2"},{name:"H2"}],[{name:"L3"},{name:"H3"},{name:"L1"},{name:"L1"},{name:"H4"},{name:"L2"},{name:"H4"},{name:"H4"},{name:"H2"}],[{name:"H4"},{name:"L1"},{name:"H2"},{name:"H2"},{name:"H4"},{name:"H2"},{name:"H2"},{name:"L3"},{name:"L3"}],[{name:"L1"},{name:"L1"},{name:"H3"},{name:"H1"},{name:"H1"},{name:"L2"},{name:"L2"},{name:"L3"},{name:"L3"}],[{name:"L1"},{name:"L2"},{name:"L2"},{name:"H1"},{name:"H4"},{name:"H4"},{name:"H2"},{name:"H3"},{name:"H2"}],[{name:"L3"},{name:"L3"},{name:"L3"},{name:"H3"},{name:"H1"},{name:"L3"},{name:"H3"},{name:"H3"},{name:"H2"}]],paddingPositions:[216,205,195,16,65,30,126],gameType:"basegame",anticipation:[0,0,0,0,0,0,0]},setTotalWin:{type:"setTotalWin",amount:1e3},finalWin:{type:"finalWin",amount:0},winInfo:{type:"winInfo",totalWin:220,wins:[{symbol:"L3",clusterSize:5,win:20,positions:[{reel:4,row:6},{reel:5,row:6},{reel:6,row:6},{reel:6,row:5},{reel:5,row:5}],meta:{globalMult:1,clusterMult:1,winWithoutMult:.2,overlay:{reel:5,row:5}}},{symbol:"H2",clusterSize:5,win:200,positions:[{reel:3,row:5},{reel:4,row:5},{reel:4,row:4},{reel:5,row:4},{reel:5,row:3}],meta:{globalMult:1,clusterMult:1,winWithoutMult:2,overlay:{reel:4,row:3}}}]},updateTumbleWin:{type:"updateTumbleWin",amount:220},tumbleBoard:{type:"tumbleBoard",newSymbols:[[],[],[],[{name:"H2"}],[{name:"L1"},{name:"L3"},{name:"L3"}],[{name:"H3"},{name:"H4"},{name:"H2"},{name:"H3"}],[{name:"L1"},{name:"L3"}]],explodingSymbols:[{reel:3,row:5},{reel:4,row:6},{reel:4,row:5},{reel:4,row:4},{reel:5,row:6},{reel:5,row:5},{reel:5,row:4},{reel:5,row:3},{reel:6,row:6},{reel:6,row:5}]},setWin:{type:"setWin",amount:550,winLevel:5},freeSpinTrigger:{type:"freeSpinTrigger",totalFs:12,positions:[{reel:0,row:2},{reel:1,row:1},{reel:4,row:1},{reel:5,row:4},{reel:6,row:4}]},updateFreeSpin:{type:"updateFreeSpin",amount:1,total:12},updateGlobalMult:{type:"updateGlobalMult",globalMult:3},updateGrid:{type:"updateGrid",gridMultipliers:[[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,1,2,1,1,1],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,1,0,0,0]]},freeSpinEnd:{type:"freeSpinEnd",amount:94270,winLevel:9},freeSpinRetrigger:{type:"freeSpinRetrigger",totalFs:20,positions:[{reel:0,row:3},{reel:3,row:6},{reel:6,row:3}]}},s=(d,g=A)=>{V(d,{get skipLoadingScreen(){return g().skipLoadingScreen},action:async()=>{var p,c;await((c=(p=g()).action)==null?void 0:c.call(p,g().data))},children:(p,c)=>{X(p,{lang:"en",children:(S,L)=>{Y(S,{})},$$slots:{default:!0}})},$$slots:{default:!0}})},Z={title:"MODE_BONUS/bookEvent"},{Story:i}=Q();var ee=z("<!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!>",1);function W(d,g){P(g,!1),J(),K();var p=ee(),c=q(p);const S=n(()=>r({skipLoadingScreen:!0,data:o.reveal,action:async e=>await t(e,{bookEvents:[]})}));i(c,{name:"reveal",get args(){return a(S)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var L=m(c,2);const H=n(()=>r({skipLoadingScreen:!0,data:o.setTotalWin,action:async e=>await t(e,{bookEvents:[]})}));i(L,{name:"setTotalWin",get args(){return a(H)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var y=m(L,2);const C=n(()=>r({skipLoadingScreen:!0,data:o.freeSpinTrigger,action:async e=>await t(e,{bookEvents:[]})}));i(y,{name:"freeSpinTrigger",get args(){return a(C)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var u=m(y,2);const E=n(()=>r({skipLoadingScreen:!0,data:o.freeSpinRetrigger,action:async e=>await t(e,{bookEvents:[]})}));i(u,{name:"freeSpinRetrigger",get args(){return a(E)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var _=m(u,2);const F=n(()=>r({skipLoadingScreen:!0,data:o.updateFreeSpin,action:async e=>await t(e,{bookEvents:[]})}));i(_,{name:"updateFreeSpin",get args(){return a(F)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var v=m(_,2);const $=n(()=>r({skipLoadingScreen:!0,data:o.winInfo,action:async e=>await t(e,{bookEvents:[]})}));i(v,{name:"winInfo",get args(){return a($)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var w=m(v,2);const M=n(()=>r({skipLoadingScreen:!0,data:o.updateTumbleWin,action:async e=>await t(e,{bookEvents:[]})}));i(w,{name:"updateTumbleWin",get args(){return a(M)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var f=m(w,2);const x=n(()=>r({skipLoadingScreen:!0,data:o.tumbleBoard,action:async e=>await t(e,{bookEvents:[]})}));i(f,{name:"tumbleBoard",get args(){return a(x)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var k=m(f,2);const U=n(()=>r({skipLoadingScreen:!0,data:o.updateGlobalMult,action:async e=>await t(e,{bookEvents:[]})}));i(k,{name:"updateGlobalMult",get args(){return a(U)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var G=m(k,2);const B=n(()=>r({skipLoadingScreen:!0,data:o.updateGrid,action:async e=>await t(e,{bookEvents:[]})}));i(G,{name:"updateGrid",get args(){return a(B)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var T=m(G,2);const R=n(()=>r({skipLoadingScreen:!0,data:o.setWin,action:async e=>await t(e,{bookEvents:[]})}));i(T,{name:"setWin",get args(){return a(R)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var b=m(T,2);const I=n(()=>r({skipLoadingScreen:!0,data:o.freeSpinEnd,action:async e=>await t(e,{bookEvents:[]})}));i(b,{name:"freeSpinEnd",get args(){return a(I)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}});var h=m(b,2);const O=n(()=>r({skipLoadingScreen:!0,data:o.finalWin,action:async e=>await t(e,{bookEvents:[]})}));i(h,{name:"finalWin",get args(){return a(O)},template:s,parameters:{__svelteCsf:{rawCode:`<StoryGameTemplate
	skipLoadingScreen={args.skipLoadingScreen}
	action={async () => {
		await args.action?.(args.data);
	}}
>
	<StoryLocale lang="en">
		<Game />
	</StoryLocale>
</StoryGameTemplate>`}}}),D(d,p),N()}W.__docgen={data:[],name:"ModeBonusBookEvent.stories.svelte"};const l=j(W,Z),oe=["Reveal","SetTotalWin","FreeSpinTrigger","FreeSpinRetrigger","UpdateFreeSpin","WinInfo","UpdateTumbleWin","TumbleBoard","UpdateGlobalMult","UpdateGrid","SetWin","FreeSpinEnd","FinalWin"],se={...l.Reveal,tags:["svelte-csf-v5"]},ie={...l.SetTotalWin,tags:["svelte-csf-v5"]},le={...l.FreeSpinTrigger,tags:["svelte-csf-v5"]},me={...l.FreeSpinRetrigger,tags:["svelte-csf-v5"]},pe={...l.UpdateFreeSpin,tags:["svelte-csf-v5"]},ce={...l.WinInfo,tags:["svelte-csf-v5"]},ge={...l.UpdateTumbleWin,tags:["svelte-csf-v5"]},de={...l.TumbleBoard,tags:["svelte-csf-v5"]},Se={...l.UpdateGlobalMult,tags:["svelte-csf-v5"]},Le={...l.UpdateGrid,tags:["svelte-csf-v5"]},ye={...l.SetWin,tags:["svelte-csf-v5"]},ue={...l.FreeSpinEnd,tags:["svelte-csf-v5"]},_e={...l.FinalWin,tags:["svelte-csf-v5"]};export{_e as FinalWin,ue as FreeSpinEnd,me as FreeSpinRetrigger,le as FreeSpinTrigger,se as Reveal,ie as SetTotalWin,ye as SetWin,de as TumbleBoard,pe as UpdateFreeSpin,Se as UpdateGlobalMult,Le as UpdateGrid,ge as UpdateTumbleWin,ce as WinInfo,oe as __namedExportsOrder,Z as default};
