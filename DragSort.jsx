import React, {useState, useEffect, useRef} from "react";
import "./DragSort.scss";
const demoImg = require("../../assets/imgs/node.png");
const log = console.log
const defaultNum = 16 // 默认格子数
const marginValue = 20 // 格子边距
// 移动方向，前进、静止、后退
const moveDirectionMap = {
    forward:'forward',
    static:'static',
    backwards:'backwards'
}
export function UseDragSort() {
    const containerRef = useRef(null) //格子的父容器
    const [row] = useState(Math.sqrt(defaultNum)) // 行列数
    const [imgArr] = useState(new Array(defaultNum).fill(demoImg))
    const [positionArr, setPositionArr] = useState([]) // 每个块的位置数据
    const [draggingStop, setDraggingStop] = useState(false) //是否停止拖动动作
    const [currNode,setCurrNode] = useState(Object) //当前被拖动的元素
    const [dragStartPosition,setDragStartPosition] = useState([])
    const [blockWidth,setBlockWidth] = useState(0) //单块宽度
    const [aimPosition,setAimPosition] = useState([]) //目标落地点
    const [onMouseUp,setOnMouseUp] = useState(false) //鼠标是否落下
    useEffect(() => {
        countPosition()
    }, []);
    useEffect(() => {
        if (positionArr.length) {
            initBlockSort().then()
        }
    }, [positionArr])
    useEffect( () => {
        async function setLastBlock(){
            if(onMouseUp && aimPosition.length){
                log(currNode.id)
                // 将当前拖拽块落地
                await onceAniBind(currNode,aimPosition[0],aimPosition[1]).then()
                setOnMouseUp(false)
                setAimPosition([])
            }
        }
        setLastBlock().then()
    }, [onMouseUp,aimPosition]);
    useEffect(() => {
        if (draggingStop) {
            log('拖拽起始：'+dragStartPosition)
            // 拖拽暂时停止了，检测目标元素归属
            coverCheck()
        }
    }, [draggingStop])
    // useLayoutEffect(() => {
    //     log('drag',draggingFlag)
    // },[draggingFlag]);
    // 中心点检测：当被拖动的元素A的中心点位于另一个元素B之上的时候，就判定A应该占据B的位置了
    const coverCheck = async ()=>{
        // 计算当前拖动元素的中心点：元素的宽高的一半再加上顶部和左边的距离就是中心点坐标
        const width = Number(currNode.style.width.replace('px','')/2)
        const margin = Number(currNode.style.margin.replace('px',''))
        //中心点坐标
        const centerDot = {
            left:Number(currNode.style.left.replace('px',''))+width+margin,
            top:Number(currNode.style.top.replace('px',''))+width+margin,
        }
        // mockDrawCenterDot(centerDot)
        // mockBorder()
        // 计算每个块的覆盖坐标区间，例如第一个块{left:[20,85],top:[20,85]}，中心点坐标左边距在20-85px，顶部距离在20-85内即判定进入该块区间
        // const coverRate = []
        // 是向前移动还是向后移动
        let moveTo = ''
        let validArea = false // 是否落到有效位置
        for(const v of positionArr){
            const row = [] // 一行的数据
            for(const child of v){
                // 左边起点，左边终点，顶部起点，顶部终点
                const leftBegin = child.left+child.margin
                const leftEnd = child.left+child.margin+child.width
                const topBegin = child.top+child.margin
                const topEnd = child.top+child.margin+child.width
                // 根据上面四个起点就可以当前单个块的覆盖范围
                const currRate = {left:[leftBegin,leftEnd],top:[topBegin,topEnd]}
                row.push(currRate)
                // 判定中心点坐标是否落入当前方块覆盖区间
                if(centerDot.left>=leftBegin && centerDot.left<=leftEnd && centerDot.top>=topBegin && centerDot.top <= topEnd){
                    validArea = true
                    // 存储落地点
                    setAimPosition([currRate.left[0]-marginValue,currRate.top[0]-marginValue])
                    log('有效落点-坐标区间：'+JSON.stringify(currRate))
                    // 根据落点区间和初始拖动元素的位置关系来判断moveTo,原地、前进、后退
                    if(leftBegin === dragStartPosition[0] && topBegin === dragStartPosition[1]){
                        // 原块区间
                        moveTo = moveDirectionMap.static
                    }else if(topBegin > dragStartPosition[1] || (topBegin === dragStartPosition[1] && leftBegin > dragStartPosition[0])){
                        // 落点区间在原位置下面，或者同一高度但比原位置距离左边更远，一定是前进
                        moveTo = moveDirectionMap.backwards
                    }else{
                        // 后退
                        moveTo = moveDirectionMap.forward
                    }
                    // 重排开始
                    moveBlockSort(dragStartPosition,[currRate.left[0],currRate.top[0]],moveTo,currNode).then()
                }
            }
            // coverRate.push(row)
        }
        if(!validArea){
            log('无效落点-归位')
            // 无效位置的落地点就是起始点
            setAimPosition([dragStartPosition[0]-marginValue,dragStartPosition[1]-marginValue])
            // await moveBlockSort(dragStartPosition,dragStartPosition,'static',currNode)
        }
        log(moveTo)
    }

    /**
     *
     * @param beginPosition 起始位置
     * @param aimPosition 目标落地位置
     * @param moveDirection 移动方向
     * @param node 当前节点
     */
    // 移动逻辑，循环每一个节点，获取它的坐标，如果这个坐标属于被移动的范围，就给这个节点加上移动动画函数让它动起来
    // 如何确定是否属于被移动的范围，根据移动块和被占据块的左右关系来判定，计算出大于某个坐标值的块都需要被移动
    // 具体怎么动？每一个块只会移动一格，而且要么是向前要么是向后，比较简单（即使换行，对于positionArr来说也是前后一个坐标的含义）
    async function moveBlockSort(beginPosition,aimPosition,moveDirection,node){
        // 先将位置的二维数组扁平化，格子的布局都是固定的，便于获取前后的位置
        const sortMap = positionArr.flat()
        // 全部节点
        const nodes = new Array(...containerRef.current.childNodes).filter(v=>{return Boolean(v.id)})
        // 根据节点位置计算一个节点的绝对排序，即属于n个节点中的第几个
        const nodeIndex = (_node)=>{
            for(let i=0;i<sortMap.length;i++){
                if(sortMap[i].left+'px' === _node.style.left && sortMap[i].top+'px' === _node.style.top){
                    return i
                }
            }
            return -1

        }
        // 需要被移动的元素和它的物理顺序位置
        const moveIndexArr = []
        const isForward = moveDirection === moveDirectionMap.forward
        if(moveDirection === moveDirectionMap.static){
            // 原地移动，将被拖动的元素放回起始点即可
            onceAniBind(node,beginPosition[0]-marginValue,beginPosition[1]-marginValue).then()
        }else{
            for(let i=0;i<nodes.length;i++){
                // 排除当前节点
                if(nodes[i].id === node.id)continue
                // 循环所有节点
                const margin = Number(currNode.style.margin.replace('px',''))
                const nodeLeft = Number(nodes[i].style.left.replace('px',''))+margin
                const nodeTop = Number(nodes[i].style.top.replace('px',''))+margin
                // 基于起始位置向前移动,那么确定需要移动的块（称为活动块）：起始点（不包括）之前到落地点（包括）之间的所有块；向后移动一格
                if(isForward){
                    // 当前节点是否位于起始点之前
                    const isBeforeBegin = nodeTop < beginPosition[1] || (nodeTop === beginPosition[1] && nodeLeft < beginPosition[0])
                    // 当前节点是否位于目标点之后或者处于目标点
                    const isAimAfter = nodeTop > aimPosition[1] || (nodeTop === aimPosition[1] && nodeLeft >= aimPosition[0])
                    if(isBeforeBegin && isAimAfter){
                        // 这是一个活动块，获取他的顺序位置
                        const currNodeIndex = nodeIndex(nodes[i])
                        // 它应该去的位置就是后退一格
                        moveIndexArr.push([sortMap[currNodeIndex+1],nodes[i]])
                    }
                }else{
                    // 基于起始位置向后移动,那么确定需要移动的块（称为活动块）：起始点（不包括）之前到落地点（包括）之间的所有块；向前移动一格
                    // 当前节点是否位于起始点之后
                    const isAfterBegin = nodeTop > beginPosition[1] || (nodeTop === beginPosition[1] && nodeLeft > beginPosition[0])
                    // 当前节点是否位于目标点之前或者处于目标点
                    const isAimBefore = nodeTop < aimPosition[1] || (nodeTop === aimPosition[1] && nodeLeft <= aimPosition[0])
                    if(isAfterBegin && isAimBefore){
                        // 这是一个活动块，获取他的顺序位置
                        const currNodeIndex = nodeIndex(nodes[i])
                        // 它应该去的位置就是前进一格
                        moveIndexArr.push([sortMap[currNodeIndex-1],nodes[i]])
                    }

                }
            }
        }
        // 根据moveIndexArr数据，依次对需要移动的元素绑定移动动画
        for(const v of moveIndexArr){
            onceAniBind(v[1],v[0].left,v[0].top).then()
        }
        // 最后把自己放置到目标点
        // TODO：未解决被拖动点应该在松开鼠标之后才落地，而不是悬停就落地了，跟活动块的移动要分离，不然体验不好
        // await onceAniBind(node,aimPosition[0]-marginValue,aimPosition[1]-marginValue)
    }
    // 模拟绘制中心点
    function mockDrawCenterDot(centerDot){
        const newDiv = document.createElement("div")
        // 要注意中心点本身的宽高，不然会绘制偏差
        const width = 10
        newDiv.style.width = width+'px'
        newDiv.style.height = width+'px'
        newDiv.style.position = 'absolute'
        newDiv.style.left = centerDot.left-width/2+'px'
        newDiv.style.top = centerDot.top-width/2+'px'
        newDiv.style.zIndex = '700'
        newDiv.style.backgroundColor = '#00c175'
        containerRef.current.appendChild(newDiv)
    }
    // 调试的时候添加边框
    function mockBorder(){
        for(const v of positionArr){
            for(const child of v){
                const newDiv = document.createElement("div")
                newDiv.style.border = "4px #00ffd7 solid"
                newDiv.style.boxSizing = "border-box"
                newDiv.style.width = child.width+'px'
                newDiv.style.height = child.width+'px'
                newDiv.style.position = 'absolute'
                newDiv.style.left = child.left+child.margin+'px'
                newDiv.style.top = child.top+child.margin+'px'
                newDiv.style.zIndex = '800'
                newDiv.style.pointerEvents = "none";
                // newDiv.style.margin = child.margin+'px'
                containerRef.current.appendChild(newDiv)
            }
        }
    }

    /**
     * 根据宫格数量生成每个宫格的绝对定位位置
     * @returns {[{top: number, left: number}]} 位置坐标
     */
    function countPosition() {
        // 生成一个x维矩阵
        let _positionArr = Array(row).fill(Array(row).fill({top: 0, left: 0, width: 0}))
        _positionArr = JSON.parse(JSON.stringify(_positionArr))
        // 获取容器尺寸
        const containerSize = containerRef.current.clientWidth
        // 单格宽度
        const blockWidth = containerSize / row
        setBlockWidth(blockWidth)
        let idx = 0
        for (let x = 0; x < _positionArr.length; x++) { //横坐标
            for (let y = 0; y < _positionArr[x].length; y++) { // 纵坐标
                // 根据位置计算每个位置的top和left
                _positionArr[x][y].top = blockWidth * x
                _positionArr[x][y].left = blockWidth * y
                // 宽度扣除margin的值保证刚好填满格子
                _positionArr[x][y].width = blockWidth - marginValue * 2
                _positionArr[x][y].margin = marginValue
                initAniStyle(_positionArr[x][y], idx)
                idx++
            }
        }
        setPositionArr(_positionArr)
    }

    /**
     * 初始化每个方块的位置
     */
    async function initBlockSort() {
        // log("初始化")
        // 全部方块节点
        const childNodes = containerRef.current.childNodes
        // 开始根据数据，初始化方块位置和尺寸
        const formatChildNodes = Array(row).fill(Array(row).fill({top: 0, left: 0}))
        let idx = 0
        for (let x = 0; x < positionArr.length; x++) {
            for (let y = 0; y < positionArr[x].length; y++) {
                // 设置每个方块的初始位置
                childNodes[idx].style.width = positionArr[x][y].width + 'px'
                childNodes[idx].style.height = positionArr[x][y].width + 'px'
                await executeInitAni(childNodes[idx], idx, positionArr[x][y].width)
                childNodes[idx].style.left = positionArr[x][y].left + 'px'
                childNodes[idx].style.top = positionArr[x][y].top + 'px'
                childNodes[idx].style.margin = positionArr[x][y].margin + 'px'
                // 给每个方块加上鼠标按下事件监听
                childNodes[idx].addEventListener('mousedown', clickDown.bind(null, childNodes[idx]), false)
                // 这里顺便把节点转为跟位置数据一致的n维矩阵形式，用于处理后续的拖动排序操作
                formatChildNodes[x][y] = childNodes[idx]
                idx++
                // 给最后一个格子添加动画执行完成监听
                if (idx === defaultNum - 1) {
                    childNodes[idx].addEventListener('webkitAnimationEnd', () => {
                        // 动画完成后清除掉animation类,否则会导致拖动的坐标设置失效
                        for (const node of childNodes) {
                            node.style.animation = ''
                        }
                    })
                }
            }
        }

    }

    /**
     * 生成初始化动画,根据每个方块生成一个动画keyframes，
     * 其实也可以动态修改同一个动画再赋值，没必要影响不大，
     * 都是从（0，0）起始移动到指定位置
     * @param nodePosition 位置数据
     * @param index 索引，用于绑定动画
     */
    const initAniStyle = (nodePosition, index) => {
        document.styleSheets[0].insertRule(`
          @-webkit-keyframes ani${index}{ from{ left:0px;top:0px } to { left:${nodePosition.left}px;top:${nodePosition.top}px; }}
        `, 0)
    }

    /**
     * 执行单个块动画
     * @param targetNode 块节点
     * @param index 块序号
     * @param width 宽度
     * @returns {Promise<unknown>}
     */
    const executeInitAni = async (targetNode, index, width) => {
        return new Promise((resolve) => {
            const sizeStyle = `width:${width}px;height:${width}px`
            const animStyle = `ani${index} 0.8s ease-in-out forwards`
            targetNode.setAttribute('style', `animation:${animStyle};-webkit-animation:${animStyle};${sizeStyle}`)
            setTimeout(() => {
                // 意味着动画之间的间隔
                resolve()
            }, 10)
        })

    }
    /**
     *  为一个元素绑定并执行一个一次性移动动画
     * @param el 元素
     * @param left 位置
     * @param top
     */
    const onceAniBind = async (el, left, top) => {
        // 创造个30位左右的随机数当类名
        const timeStampSign = String(Math.random()).slice(2,20)+String(Math.random()).slice(2,20)
        const aniLen = 0.5 //动画时长s
        // 以随机戳为标识创建一个动画帧
        document.styleSheets[0].insertRule(`
          @-webkit-keyframes ani${timeStampSign}{ from{ left:${el.style.left};top:${el.style.top} } to { left:${left}px;top:${top}px; }}
        `, 0)
        // 为目标元素绑定创建的动画，使用promise可以方便兼容需要依次执行动画的场景
        return new Promise((aniEnd) => {
            const animStyle = `ani${timeStampSign} ${aniLen}s ease-in-out forwards`
            el.setAttribute('style', `animation:${animStyle};-webkit-animation:${animStyle};`)
            el.addEventListener('webkitAnimationEnd', () => {
                // 动画完成后清除掉animation类,否则会导致拖动的坐标设置失效
                el.style.animation = ''
                // 固定动画终点位置
                el.style.left = left + 'px'
                el.style.top = top + 'px'
                el.style.width = blockWidth-marginValue*2 + 'px'
                el.style.height = blockWidth-marginValue*2 + 'px'
                el.style.margin = marginValue + 'px'
                aniEnd()
            })
        })
    }
    let timer = null
    let movePixel = [-999, -999]
    const clickDown = (targetNode, e) => {
        setCurrNode(targetNode)
        // 记录被拖拽元素的起始位置
        const _left = Number(targetNode.style.left.replace('px',''))
        const _top = Number(targetNode.style.top.replace('px',''))
        const _margin = Number(targetNode.style.margin.replace('px',''))
        const dragPositionLeft = _left+_margin
        const dragPositionTop = _top+_margin
        setDragStartPosition([dragPositionLeft,dragPositionTop])
        // 写个定时器判断拖动是否停止
        if (!timer) {
            timer = setInterval(() => {
                if (movePixel[0] === targetNode.style.left && movePixel[1] === targetNode.style.top) {
                    // 一定时间内拖动间隔不再更新就判定停止
                    setDraggingStop(true)
                } else {
                    // 拖动中就一直更新坐标，并且更新拖动味停止状态
                    [movePixel[0], movePixel[1]] = [targetNode.style.left, targetNode.style.top]
                    setDraggingStop(false)
                }
            }, 200)
        }
        targetNode.style.cursor = 'pointer';
        let offsetX = parseInt(targetNode.style.left) // 获取当前的x轴距离
        let offsetY = parseInt(targetNode.style.top) // 获取当前的y轴距离
        let innerX = e.clientX - offsetX // 获取鼠标在方块内的x轴距
        let innerY = e.clientY - offsetY // 获取鼠标在方块内的y轴距
        // 按住鼠标时为targetNode添加一个border
      /*  targetNode.style.borderStyle = 'solid'
        targetNode.style.borderColor = 'green'
        targetNode.style.borderWidth = '3px'*/
        targetNode.style.zIndex = '700'
        // 根据鼠标的移动轨迹修改目标节点的位置
        document.onmousemove = (e) => {
            targetNode.style.left = e.clientX - innerX + 'px'
            targetNode.style.top = e.clientY - innerY + 'px'
            // 防止出界
            if (parseInt(targetNode.style.left) <= 0) {
                targetNode.style.left = '0px'
            }
            if (parseInt(targetNode.style.top) <= 0) {
                targetNode.style.top = '0px'
            }
            if (parseInt(targetNode.style.right) <= 0) {
                targetNode.style.right = '0px'
            }
            if (parseInt(targetNode.style.bottom) <= 0) {
                targetNode.style.bottom = '0px'
            }
            if (parseInt(targetNode.style.left) >= window.innerWidth - parseInt(targetNode.style.width)) {
                targetNode.style.left = window.innerWidth - parseInt(targetNode.style.width) + 'px'
            }
            if (parseInt(targetNode.style.top) >= window.innerHeight - parseInt(targetNode.style.height)) {
                targetNode.style.top = window.innerHeight - parseInt(targetNode.style.height) + 'px'
            }
        }

        // 鼠标抬起时后清除一系列事件
        document.onmouseup = () => {
            // log('鼠标抬起，清除事件')
            clearInterval(timer)
            timer = null
            // 如果不悬停直接松开鼠标，要判定停止拖动
            // 如果已经被悬停计时器判定了未松开鼠标的拖动停止（会触发拖动停止的监听事件），再松开鼠标的时候就应该不再认为是拖动停止，所以取反
            setDraggingStop(prevState => !prevState)
            document.onmousemove = null
            document.onmouseup = null
            // 清除border
            targetNode.style.borderStyle = ''
            targetNode.style.borderColor = ''
            targetNode.style.borderWidth = ''
            targetNode.style.zIndex = '2'
            setOnMouseUp(true)

        }
    }
    return (
        <div className={"drag-box"}>
            <h1>拖动排序</h1>
            <div ref={containerRef} className={'block-box'}>
                {
                    imgArr.map((item, index) => {
                        return (
                            <div className={'block-img'} id={`${index}`} key={index}>{index+1}</div>
                        )
                    })
                }
            </div>
        </div>
    )
}
