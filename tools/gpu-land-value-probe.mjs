// Native worker diagnostic only. Never installs approximate GPU values in W.
// Inject probeLandValues.toString() into the actual model worker after generation.
export async function probeLandValues(){
  if(!navigator.gpu)return{available:false,reason:'WebGPU is unavailable'};
  const startup=performance.now(),adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  if(!adapter)return{available:false,reason:'No WebGPU adapter'};
  if(adapter.info.isFallbackAdapter)return{available:false,reason:'Software adapter',adapter:{...adapter.info.toJSON?.()}};
  const device=await adapter.requestDevice(),failures=[];device.addEventListener('uncapturederror',e=>failures.push(e.error.message));
  const shader=`struct Town { origin:vec2f, n:u32, start:u32, jobs:vec4u, rest:vec4u }
@group(0) @binding(0) var<storage,read> towns:array<Town>;
@group(0) @binding(1) var<storage,read> points:array<vec4f>;
@group(0) @binding(2) var<storage,read_write> values:array<vec4f>;
@compute @workgroup_size(128) fn main(@builtin(global_invocation_id) gid:vec3u){
 let k=gid.x;if(k>=arrayLength(&values)){return;}
 var lo=0u;var hi=arrayLength(&towns);
 loop{if(lo+1u>=hi){break;}let mid=(lo+hi)/2u;if(towns[mid].start<=k){lo=mid;}else{hi=mid;}}
 let t=towns[lo];let local=k-t.start;
 let p=t.origin+(vec2f(f32(local%t.n),f32(local/t.n))+vec2f(0.5))*16.0;
 var v=vec4f(0.0);
 for(var i=t.jobs.x;i<t.jobs.y;i++){let q=points[i];let d=abs(q.xy-p);if(d.x+d.y<700.0){v.x+=q.z*exp(-length(d)/100.0);}}
 for(var i=t.jobs.z;i<t.jobs.w;i++){let q=points[i];let d=abs(q.xy-p);if(d.x<=200.0&&d.y<=200.0){v.y+=q.z*exp(-length(d)/70.0);}}
 for(var i=t.rest.x;i<t.rest.y;i++){v.z+=exp(-distance(points[i].xy,p)/90.0);}
 for(var i=t.rest.z;i<t.rest.w;i++){v.w+=exp(-distance(points[i].xy,p)/35.0);}
 values[k]=v;
}`;
  let module,pipeline;
  try{
    module=device.createShaderModule({code:shader});
    const compilation=await module.getCompilationInfo();const errors=compilation.messages.filter(m=>m.type==='error');
    if(errors.length)throw Error(errors.map(e=>e.message).join('\n'));
    pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
    const startupMs=performance.now()-startup,settlements=W.settlements.filter(s=>s.buildings.length),cpu=[],gpu=[],maxError={res:0,biz:0};
    const reference=()=>settlements.map(s=>{const previous=Object.getOwnPropertyDescriptor(s,'_lvf');try{if(previous)s._lvf=null;return lvField(s);}finally{if(previous)Object.defineProperty(s,'_lvf',previous);else delete s._lvf;}});
    // Warm reference with the real implementation, then include its complete annual rebuild.
    reference();let expected;
    for(let i=0;i<3;i++){const t=performance.now();expected=reference();cpu.push(performance.now()-t);}
    const prepare=()=>{
      const pts=[],towns=[],meta=new ArrayBuffer(settlements.length*48),f32=new Float32Array(meta),u32=new Uint32Array(meta);let total=0;
      for(let si=0;si<settlements.length;si++){
        const s=settlements[si],R=Math.max(s.wallR||0,s.extentR||s.radius||100)+90,x0=s.pos.x-R,z0=s.pos.z-R,n=Math.ceil(2*R/LVC),start=total,N=n*n;
        const H0=[];for(const b of s.buildings)if(!b.removed&&b.state==='sound'&&RESID.has(b.arch))H0.push([b.x,b.z,1]);
        const ranges=[];for(const group of [lvBin(lvJobs(s),32),lvBin(H0,32),(s.places||[]).filter(p=>p.kind==='market').map(p=>[p.x,p.z,1]),s.buildings.filter(b=>!b.removed&&(b.arch==='tannery'||b.arch==='dyer')).map(b=>[b.x,b.z,1])]){ranges.push(pts.length/4);for(const p of group)pts.push(p[0],p[1],p[2],0);ranges.push(pts.length/4);}
        const o=si*12;f32[o]=x0;f32[o+1]=z0;u32[o+2]=n;u32[o+3]=start;u32.set(ranges,o+4);towns.push({s,x0,z0,n,N,start});total+=N;
      }return{towns,meta,points:new Float32Array(pts),total};
    };
    const finish=(t,values)=>{
      const {s,x0,z0,n,N,start}=t,job=new Float32Array(N),hh=new Float32Array(N),mk=new Float32Array(N),nu=new Float32Array(N),ft=new Float32Array(N);
      for(let k=0;k<N;k++){const i=(start+k)*4;job[k]=values[i];hh[k]=values[i+1];mk[k]=values[i+2];nu[k]=values[i+3];}
      const cx=i=>x0+(i+.5)*LVC,cz=j=>z0+(j+.5)*LVC;
      for(const st of s.streets||[]){if(st.hidden||st.gone||st.kind==='edge')continue;const w=st.kind==='road'||st.kind==='mstreet'||st.market?1:st.kind==='quay'?.9:.55;
        for(const p of resample(st.pts,5)){const i0=Math.floor((p.x-x0)/LVC),j0=Math.floor((p.z-z0)/LVC);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=i0+di,j=j0+dj;if(i<0||j<0||i>=n||j>=n)continue;const v=w*Math.exp(-Math.max(0,Math.hypot(cx(i)-p.x,cz(j)-p.z)-st.hw)/10),k=j*n+i;if(v>ft[k])ft[k]=v;}}}
      const mx=A=>{let m=1e-6;for(const v of A)if(v>m)m=v;return m;},mj=mx(job),mh=mx(hh),mm=mx(mk),fear=(s.raidedUntil>day()?1:0)+(s.siegeBy?1:0)+(W.war?.4:0),res=new Float32Array(N),biz=new Float32Array(N);
      for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i,safe=inWalls(s,cx(i),cz(j))?.3+.25*fear:0,stink=Math.min(1,nu[k]);res[k]=Math.max(.03,.06+.85*job[k]/mj+.3*mk[k]/mm+safe-.35*stink);biz[k]=Math.max(.02,.05+.9*ft[k]*(.4+.6*hh[k]/mh)+.45*mk[k]/mm+.25*hh[k]/mh+safe*.5-.15*stink);}
      return{res,biz};
    };
    let cells=0;
    for(let run=0;run<4;run++){
      const started=performance.now(),p=prepare(),buffers=[];cells=p.total;
      try{
        const upload=data=>{const b=device.createBuffer({size:Math.max(16,data.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});buffers.push(b);device.queue.writeBuffer(b,0,data);return b;};
        const towns=upload(p.meta),points=upload(p.points),output=device.createBuffer({size:p.total*16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),read=device.createBuffer({size:p.total*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});buffers.push(output,read);
        const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:towns}},{binding:1,resource:{buffer:points}},{binding:2,resource:{buffer:output}}]});
        const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(p.total/128));pass.end();encoder.copyBufferToBuffer(output,0,read,0,p.total*16);device.queue.submit([encoder.finish()]);await read.mapAsync(GPUMapMode.READ);
        const values=new Float32Array(read.getMappedRange());let actual;
        actual=p.towns.map(t=>finish(t,values));const elapsed=performance.now()-started;
        if(run)gpu.push(elapsed);read.unmap();
        if(run===3)for(let si=0;si<actual.length;si++)for(const key of ['res','biz'])for(let k=0;k<actual[si][key].length;k++){const value=actual[si][key][k];if(!Number.isFinite(value))throw Error('Nonfinite GPU field');maxError[key]=Math.max(maxError[key],Math.abs(value-expected[si][key][k]));}
      }finally{for(const b of buffers)b.destroy();}
    }
    if(failures.length)throw Error(failures.join('\n'));
    if(Math.max(maxError.res,maxError.biz)>1e-4)throw Error('GPU field error exceeds diagnostic tolerance: '+JSON.stringify(maxError));
    const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],cpuMs=median(cpu),gpuMs=median(gpu);
    return{available:true,adapter:{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter},startupMs,settlements:settlements.length,cells,cpuMs,gpuMs,speedup:cpuMs/gpuMs,cpuSamples:cpu,gpuSamples:gpu,maxAbsoluteError:maxError,canonicalValuesChanged:false,limitation:'Annual field kernel only; not whole-tick speed or GPU game integration'};
  }finally{device.destroy();}
}
